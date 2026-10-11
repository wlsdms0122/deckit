DeckitModule.define(
    'deckit/service/open/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host',
            'deckit/service/open/model/scheme',
            'deckit/service/open/model/protocol',
        ],
        provides: ['start', 'open'],
    },
    (CONFIG, STORAGE, LOG, IDENTITY, HOST, SCHEME, PROTOCOL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const CHOSEN = 'open-with';
        // A handler that has not answered by then passes, so one stuck page does not hold every link.
        const OFFER_MS = 3000;
        // What deckit opens by itself, after every plugin that takes the scheme: the answer that is always last.
        const SYSTEM = new Map([
            ['http', 'browser'],
            ['https', 'browser'],
            ['file', 'file'],
        ]);
        const handlers = new Set(); // plugin ids whose view answers offers

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.open.handle((request, sender) => {
                IDENTITY.pluginFrom(sender);
                return open(request.url, {
                    ...request,
                    userInitiated: request.userInitiated && IDENTITY.hasUserActivation(sender),
                });
            });
            PROTOCOL.handles.on((_payload, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                handlers.add(plugin.id);
                IDENTITY.whenPageEnds(sender, () => handlers.delete(plugin.id));
            });
            // Only on a person's click or key: otherwise any plugin could open Finder at will, or learn which paths exist.
            PROTOCOL.reveal.handle(({ file }, sender) => {
                IDENTITY.pluginFrom(sender);
                return IDENTITY.hasUserActivation(sender) && reveal(file);
            });
            PROTOCOL.lines.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.url-schemes');
                return lines().map((line) => ({
                    id: line,
                    system: line === SCHEME.EVERY ? null : SYSTEM.get(line) || null,
                    handlers: handlersOf(line),
                }));
            });
            PROTOCOL.setLine.handle(({ line, order, off }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.url-schemes');
                return setLine(line, order, off);
            });
        }

        // Each plugin in the scheme's line is asked in turn and the first to take it ends it; then deckit's own answer.
        async function open(
            url,
            { activates = true, userInitiated = false, usesDefaultApp = false, target = '' } = {}
        ) {
            const address = String(url).trim();
            const scheme = schemeOf(address);
            if (!scheme || SCHEME.NOT_PLACES.has(scheme)) return false;
            const options = { activates, userInitiated, target };
            if (!usesDefaultApp && (await offer(lineFor(scheme), address, options))) return true;
            return system(scheme, address, options);
        }

        // MARK: - Private
        function schemeOf(url) {
            const at = url.indexOf(':');
            const scheme = at > 0 ? url.slice(0, at).toLowerCase() : '';
            return SCHEME.SCHEME.test(scheme) ? scheme : '';
        }

        function chosen() {
            return STORAGE.state.read(CHOSEN, {});
        }

        // Every scheme a line can be for: deckit's own, then each one a running plugin names, then every other.
        function lines() {
            const named = HOST.plugins()
                .filter(({ id }) => handlers.has(id))
                .flatMap(({ urlSchemes }) => urlSchemes);
            const own = named.filter((scheme) => scheme !== SCHEME.EVERY);
            return [...new Set([...SYSTEM.keys(), ...own, ...(named.includes(SCHEME.EVERY) ? [SCHEME.EVERY] : [])])];
        }

        function lineFor(scheme) {
            return scheme !== SCHEME.EVERY && lines().includes(scheme) ? scheme : SCHEME.EVERY;
        }

        // What the app names first and the person has not placed, then what the person placed.
        function orderOf(line) {
            const saved = savedOf(line);
            const appFirst = Object.hasOwn(CONFIG.openWith, line) ? CONFIG.openWith[line] : [];
            return [...appFirst.filter((id) => !saved.order.includes(id)), ...saved.order];
        }

        function savedOf(line) {
            return Object.hasOwn(chosen(), line) ? chosen()[line] : { order: [], off: [] };
        }

        // In the line's order; a plugin no one placed keeps the place the plugins' order gives it.
        function handlersOf(line) {
            const order = orderOf(line);
            const off = savedOf(line).off;
            const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
            return HOST.plugins()
                .filter(
                    (plugin) =>
                        handlers.has(plugin.id) &&
                        plugin.urlSchemes.some((scheme) => scheme === SCHEME.EVERY || scheme === line)
                )
                .map((plugin, at) => ({ id: plugin.id, name: plugin.name, on: !off.includes(plugin.id), at }))
                .sort((a, b) => rank(a.id) - rank(b.id) || a.at - b.at)
                .map(({ at, ...handler }) => handler);
        }

        // The ids given take the places they held among themselves. A plugin missing from the line now (failed to
        // load, or waiting on what it requires) keeps its place and switch: otherwise editing the line while it was
        // gone would give its place to the app's default.
        function setLine(line, order, off) {
            if (!lines().includes(line)) throw new Error('there is no Open With line ' + line);
            const given = new Set(order);
            const next = [...order];
            const merged = orderOf(line).map((id) => (given.has(id) ? next.shift() : id));
            merged.push(...next);
            const offKept = savedOf(line).off.filter((id) => !given.has(id));
            STORAGE.state.write(CHOSEN, { ...chosen(), [line]: { order: merged, off: [...offKept, ...off] } });
            return true;
        }

        // Only a plain true takes it, so a forgotten return passes it on rather than losing it.
        async function offer(line, url, options) {
            for (const handler of handlersOf(line)) {
                if (!handler.on) continue;
                const view = IDENTITY.viewOf(handler.id);
                if (!view) continue;
                const taken = await PROTOCOL.offer
                    .invoke(view, { url, options }, { timeout: OFFER_MS })
                    .catch((error) => {
                        LOG.warn(`${handler.id} could not open ${url}`, error);
                        return false;
                    });
                if (taken === true) return true;
            }
            return false;
        }

        // The web goes to the system browser. A file is opened in its app when a person asked for it, and shown in
        // Finder otherwise, whatever it is, since no list of which files are programs is complete.
        async function system(scheme, url, { activates, userInitiated }) {
            const { shell } = require('electron');
            if (SYSTEM.get(scheme) === 'browser') {
                await shell.openExternal(url, { activate: activates });
                return true;
            }
            if (SYSTEM.get(scheme) !== 'file') return false;
            const file = existing(filePathOf(url));
            if (!file) return false;
            if (!userInitiated) {
                shell.showItemInFolder(file);
                return true;
            }
            return !(await shell.openPath(file));
        }

        function reveal(file) {
            const found = existing(file);
            if (found) require('electron').shell.showItemInFolder(found);
            return !!found;
        }

        function existing(file) {
            if (!path.isAbsolute(String(file))) return '';
            const resolved = path.resolve(file);
            return fs.existsSync(resolved) ? resolved : '';
        }

        function filePathOf(url) {
            const parsed = new URL(url);
            if (parsed.host && parsed.host !== 'localhost') return '';
            return decodeURIComponent(parsed.pathname);
        }

        return { start, open };
    }
);
