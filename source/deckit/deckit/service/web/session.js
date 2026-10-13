DeckitModule.define(
    'deckit/service/web/session',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/service/web/model/partition',
            'deckit/service/deck/model/origin',
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
        const made = new Map(); // partition -> { session, plugin, name }
        const created = new Set(); // listeners told of every plugin session as it is made

        // MARK: - Initializer
        // MARK: - Public
        // The session deckit's own pages load in, apart from the app's.
        function own() {
            return require('electron').session.fromPartition(`persist:${CONFIG.id}`);
        }

        // A plugin's web session by name, made on first use. Its partition is spelled from the plugin's id, so a
        // plugin names its own sessions and no one else's.
        function of(pluginId, name) {
            const spelled = PARTITION.spell(pluginId, name);
            if (made.has(spelled)) return made.get(spelled).session;
            const session = require('electron').session.fromPartition(spelled);
            made.set(spelled, { session, plugin: pluginId, name });
            keepSessionCookies(session);
            remember(pluginId, name);
            for (const listener of created) listener(session, pluginId);
            return session;
        }

        // The partition of a page in a plugin's session, or '' for one in any other.
        function partitionOf(webContents) {
            for (const [partition, { session }] of made) if (session === webContents.session) return partition;
            return '';
        }

        function onCreate(listener) {
            created.add(listener);
        }

        // Read whole as bytes arrive, held to a limit: this is the app's process, and a huge answer would be held
        // whole first.
        async function fetchText(pluginId, name, url) {
            if (!/^https?:\/\//i.test(url)) throw new Error('not a web address: ' + url);
            const response = await of(pluginId, name).fetch(url, { redirect: 'follow' });
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

        async function clear(pluginId, name) {
            const session = of(pluginId, name);
            await session.clearStorageData();
            await session.clearCache();
            await session.clearAuthCache();
        }

        // What a plugin kept in sessions: its pages' storage in deckit's own session, and every session it made.
        async function forget(pluginId) {
            await own().clearStorageData({ origin: ORIGIN.originOf(pluginId) });
            const sessions = STORAGE.state.read(SESSIONS, {});
            for (const name of sessions[pluginId] || []) await clear(pluginId, name);
            delete sessions[pluginId];
            STORAGE.state.write(SESSIONS, sessions);
            LOG.info(`forgot the web sessions of ${pluginId}`);
        }

        // MARK: - Private
        function remember(pluginId, name) {
            const sessions = STORAGE.state.read(SESSIONS, {});
            if ((sessions[pluginId] || []).includes(name)) return;
            sessions[pluginId] = [...(sessions[pluginId] || []), name];
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
