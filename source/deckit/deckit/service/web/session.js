DeckitModule.define(
    'deckit/service/web/session',
    {
        uses: [
            'deckit/config',
            'deck/service/storage',
            'deck/service/log/main',
            'deckit/service/web/model/partition',
            'deck/service/deck/model/origin',
        ],
        provides: ['own', 'of', 'partitionOf', 'onCreate', 'fetchText', 'clear', 'forget'],
        runs: 'main',
    },
    (CONFIG, STORAGE, LOG, PARTITION, ORIGIN) => {
        // MARK: - Property
        const SESSIONS = 'web-sessions';
        // A cookie with no expiry would sign the person out of every site at each launch; a browser restoring its
        // session keeps them, so here it is given a lifetime.
        const SESSION_COOKIE_TTL = 60 * 60 * 24 * 14;
        const FETCH_LIMIT = 4 * 1024 * 1024;
        const made = new Map(); // partition -> { session, mod, name }
        const created = new Set(); // listeners told of every mod session as it is made

        // MARK: - Initializer
        // MARK: - Public
        // The session deckit's own pages load in, apart from the app's.
        function own() {
            return require('electron').session.fromPartition(`persist:${CONFIG.id}`);
        }

        // A mod's web session by name, made on first use. Its partition is spelled from the mod's id, so a
        // mod names its own sessions and no one else's.
        function of(modId, name) {
            const spelled = PARTITION.spell(modId, name);
            if (made.has(spelled)) return made.get(spelled).session;
            const session = require('electron').session.fromPartition(spelled);
            made.set(spelled, { session, mod: modId, name });
            keepSessionCookies(session);
            remember(modId, name);
            for (const listener of created) listener(session, modId);
            return session;
        }

        // The partition of a page in a mod's session, or '' for one in any other.
        function partitionOf(webContents) {
            for (const [partition, { session }] of made) if (session === webContents.session) return partition;
            return '';
        }

        function onCreate(listener) {
            created.add(listener);
        }

        // Read whole as bytes arrive, held to a limit: this is the app's process, and a huge answer would be held
        // whole first.
        async function fetchText(modId, name, url) {
            if (!/^https?:\/\//i.test(url)) throw new Error('not a web address: ' + url);
            const response = await of(modId, name).fetch(url, { redirect: 'follow' });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            if (Number(response.headers.get('content-length')) > FETCH_LIMIT) {
                response.body?.cancel();
                throw tooLarge(response.headers.get('content-length'));
            }
            if (!response.body) return '';
            const reader = response.body.getReader();
            const chunks = [];
            let total = 0;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > FETCH_LIMIT) {
                    reader.cancel();
                    throw tooLarge(total);
                }
                chunks.push(value);
            }
            return new TextDecoder().decode(Buffer.concat(chunks));
        }

        async function clear(modId, name) {
            const session = of(modId, name);
            await session.clearStorageData();
            await session.clearCache();
            await session.clearAuthCache();
        }

        // What a mod kept in sessions: its pages' storage in deckit's own session, and every session it made.
        async function forget(modId) {
            await own().clearStorageData({ origin: ORIGIN.originOf(modId) });
            const sessions = STORAGE.state.read(SESSIONS, {});
            for (const name of sessions[modId] || []) await clear(modId, name);
            delete sessions[modId];
            STORAGE.state.write(SESSIONS, sessions);
            LOG.info(`forgot the web sessions of ${modId}`);
        }

        // MARK: - Private
        function remember(modId, name) {
            const sessions = STORAGE.state.read(SESSIONS, {});
            if ((sessions[modId] || []).includes(name)) return;
            sessions[modId] = [...(sessions[modId] || []), name];
            STORAGE.state.write(SESSIONS, sessions);
        }

        // Set on a session deckit made, as it is made, so the app's sessions are left as they are.
        function keepSessionCookies(session) {
            session.webRequest.onHeadersReceived((details, callback) => {
                const headers = details.responseHeaders || {};
                if (/^https:/i.test(details.url)) {
                    for (const key of Object.keys(headers)) {
                        if (key.toLowerCase() !== 'set-cookie') continue;
                        headers[key] = []
                            .concat(headers[key])
                            .map((cookie) =>
                                /;\s*(expires|max-age)=/i.test(cookie)
                                    ? cookie
                                    : cookie + '; Max-Age=' + SESSION_COOKIE_TTL
                            );
                    }
                }
                callback({ responseHeaders: headers });
            });
        }

        function tooLarge(bytes) {
            return new Error(`response too large: more than ${FETCH_LIMIT} bytes (${bytes})`);
        }

        return { own, of, partitionOf, onCreate, fetchText, clear, forget };
    }
);
