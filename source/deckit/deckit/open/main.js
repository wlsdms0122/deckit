DeckitModule.define(
    'deckit/open/main',
    {
        uses: [
            'deckit/config',
            'deck/storage',
            'deck/log/main',
            'deck/identity',
            'deck/catalog',
            'deck/runner/main',
            'deckit/main-process/model/permission',
            'deckit/open/model/scheme',
            'deckit/open/protocol',
            'deckit/open/model/permission',
        ],
        provides: ['start', 'open'],
    },
    (CONFIG, STORAGE, LOG, IDENTITY, CATALOG, RUNNER, MAIN_PROCESS_PERMISSION, SCHEME, PROTOCOL, OPEN_PERMISSION) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const CHOSEN = 'scheme-handlers';
        // A handler that has not answered by then passes, so one stuck page does not hold every link.
        const OFFER_MS = 3000;
        // What deckit opens by itself, after every mod that takes the scheme: the answer that is always last.
        const SYSTEM = new Map([
            ['http', 'browser'],
            ['https', 'browser'],
            ['file', 'file'],
        ]);
        const answering = new Set(); // mod ids whose page answers offers

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.open.handle((request, sender) => {
                IDENTITY.modFrom(sender);
                return open(request.url, {
                    ...request,
                    userInitiated: request.userInitiated && spendsUserActivation(sender),
                });
            });
            PROTOCOL.handles.on((_payload, sender) => {
                const mod = IDENTITY.modFrom(sender);
                answering.add(mod.id);
                // A page being replaced ends after its successor is up: only the page on duty stops answering.
                IDENTITY.whenPageEnds(sender, () => IDENTITY.pageOf(mod.id) === sender && answering.delete(mod.id));
            });
            // A run that has ended answers no offer, though its page may stay until the mod launches again.
            RUNNER.observe('didTerminate', ({ mod }) => answering.delete(mod.id));
            // Only on a person's click or key: otherwise any mod could open Finder at will, or learn which paths exist.
            PROTOCOL.reveal.handle(({ file }, sender) => {
                IDENTITY.modFrom(sender);
                return spendsUserActivation(sender) && reveal(file);
            });
            PROTOCOL.handlerLists.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, OPEN_PERMISSION.URL_SCHEMES);
                return schemes().map((scheme) => ({
                    scheme,
                    system: scheme === SCHEME.EVERY ? null : SYSTEM.get(scheme) || null,
                    handlers: handlersOf(scheme),
                }));
            });
            PROTOCOL.setHandlers.handle(({ scheme, order, off }, sender) => {
                IDENTITY.modFrom(sender, OPEN_PERMISSION.URL_SCHEMES);
                return setHandlers(scheme, order, off);
            });
        }

        // Each of the scheme's handlers is asked in turn and the first to take it ends it; then deckit's own answer. A
        // file opens only during a person's click or key, whoever answers it, as reveal shows one: otherwise any mod
        // could open apps at will, or learn which paths exist.
        async function open(
            url,
            { activates = true, userInitiated = false, usesDefaultApp = false, target = '' } = {}
        ) {
            const address = String(url).trim();
            const scheme = schemeOf(address);
            if (!scheme || SCHEME.NOT_PLACES.has(scheme)) return false;
            if (scheme === 'file' && !userInitiated) return false;
            const options = { activates, userInitiated, target };
            if (!usesDefaultApp && (await offer(handledAs(scheme), address, options))) return true;
            return system(scheme, address, options);
        }

        // MARK: - Private
        // A mod with system.main-process may run its own code in this process and could open the file itself, so its word is
        // taken; any other has to show a person's press.
        function spendsUserActivation(sender) {
            const mod = IDENTITY.modFrom(sender);
            if (mod.permissions.some(({ id }) => id === MAIN_PROCESS_PERMISSION.MAIN_PROCESS)) return true;
            return IDENTITY.consumeUserActivation(sender);
        }

        function schemeOf(url) {
            const at = url.indexOf(':');
            const scheme = at > 0 ? url.slice(0, at).toLowerCase() : '';
            return SCHEME.SCHEME.test(scheme) ? scheme : '';
        }

        function chosen() {
            return STORAGE.state.read(CHOSEN, {});
        }

        // Every scheme with a handler list: deckit's own, then each one a running mod names, then every other.
        function schemes() {
            const named = CATALOG.mods()
                .filter(({ id }) => answering.has(id))
                .flatMap(({ urlSchemes }) => urlSchemes);
            const own = named.filter((scheme) => scheme !== SCHEME.EVERY);
            return [...new Set([...SYSTEM.keys(), ...own, ...(named.includes(SCHEME.EVERY) ? [SCHEME.EVERY] : [])])];
        }

        // The scheme whose handlers an address is offered to: its own, or every scheme's when it has no list.
        function handledAs(scheme) {
            return scheme !== SCHEME.EVERY && schemes().includes(scheme) ? scheme : SCHEME.EVERY;
        }

        // What the app names first and the person has not placed, then what the person placed.
        function orderOf(scheme) {
            const saved = savedOf(scheme);
            const appFirst = Object.hasOwn(CONFIG.schemeHandlers, scheme) ? CONFIG.schemeHandlers[scheme] : [];
            return [...appFirst.filter((id) => !saved.order.includes(id)), ...saved.order];
        }

        function savedOf(scheme) {
            return Object.hasOwn(chosen(), scheme) ? chosen()[scheme] : { order: [], off: [] };
        }

        // In the scheme's order; a mod no one placed keeps the place the mods' order gives it.
        function handlersOf(scheme) {
            const order = orderOf(scheme);
            const off = savedOf(scheme).off;
            const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
            return CATALOG.mods()
                .filter(
                    (mod) =>
                        answering.has(mod.id) &&
                        mod.urlSchemes.some((named) => named === SCHEME.EVERY || named === scheme)
                )
                .map((mod, at) => ({ id: mod.id, name: mod.name, on: !off.includes(mod.id), at }))
                .sort((a, b) => rank(a.id) - rank(b.id) || a.at - b.at)
                .map(({ at, ...handler }) => handler);
        }

        // The ids given take the places they held among themselves. A mod missing from the list now (failed to
        // load, or waiting on what it requires) keeps its place and switch: otherwise editing the list while it was
        // gone would give its place to the app's default.
        function setHandlers(scheme, order, off) {
            if (!schemes().includes(scheme)) throw new Error('no mod handles ' + scheme);
            const given = new Set(order);
            const next = [...order];
            const merged = orderOf(scheme).map((id) => (given.has(id) ? next.shift() : id));
            merged.push(...next);
            const offKept = savedOf(scheme).off.filter((id) => !given.has(id));
            STORAGE.state.write(CHOSEN, { ...chosen(), [scheme]: { order: merged, off: [...offKept, ...off] } });
            return true;
        }

        // Only a plain true takes it, so a forgotten return passes it on rather than losing it.
        async function offer(scheme, url, options) {
            for (const handler of handlersOf(scheme)) {
                if (!handler.on) continue;
                const page = IDENTITY.pageOf(handler.id);
                if (!page) continue;
                const taken = await PROTOCOL.offer
                    .invoke(page, { url, options }, { timeout: OFFER_MS })
                    .catch((error) => {
                        LOG.warn(`${handler.id} could not open ${url}`, error);
                        return false;
                    });
                if (taken === true) return true;
            }
            return false;
        }

        // The web goes to the system browser, and a file to its app.
        async function system(scheme, url, { activates }) {
            const { shell } = require('electron');
            if (SYSTEM.get(scheme) === 'browser') {
                await shell.openExternal(url, { activate: activates });
                return true;
            }
            if (SYSTEM.get(scheme) !== 'file') return false;
            const file = existing(filePathOf(url));
            return !!file && !(await shell.openPath(file));
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
