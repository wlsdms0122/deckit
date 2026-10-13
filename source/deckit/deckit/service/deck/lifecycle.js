DeckitModule.define(
    'deckit/service/deck/lifecycle',
    {
        uses: [
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/deck/main',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/service/deck/protocol',
            'deckit/service/deck/model/origin',
        ],
        provides: ['start', 'pages', 'pageFor', 'onChange', 'reload'],
        runs: 'main',
    },
    (LOG, IDENTITY, DECK, WEB, KEYMAP, OPEN, PROTOCOL, ORIGIN) => {
        // MARK: - Property
        const running = new Map(); // plugin id -> { page, entry }
        const ending = new Set(); // plugin ids whose page is stopping, to run again once it has
        const listeners = new Set();
        // How long a plugin's stop() may take before its sandbox ends anyway.
        const STOP_LIMIT_MS = 2000;
        const ERR_ABORTED = -3;
        let makePage = null;
        let stopping = null; // the plugins stopping as the app quits
        const stoppedForQuit = new Set(); // pages whose run stopped for a quit

        // MARK: - Initializer
        // Every plugin that loads runs in a page of its own, whether or not it has anything to show. `makePage()` makes
        // the view a page runs in.
        function start({ makePage: make }) {
            makePage = make;
            DECK.onChange(reconcile);
            DECK.onStatus(notify);
            reconcile(DECK.plugins());
            // The app quits once every plugin's run has stopped. Held at will-quit, once every window has closed and
            // the quit is decided, while a run has not; a quit asked again meanwhile waits too. Then the quit is asked
            // again and goes on as any quit does, quit event and all, so code in the host app that ends on it ends. A
            // quit the host app calls off leaves the stopped runs stopped, and the next quit stops what ran since.
            const { app } = require('electron');
            app.on('will-quit', (event) => {
                const unstopped = [...running.values()]
                    .map(({ page }) => page)
                    .filter((page) => !stoppedForQuit.has(page));
                if (!stopping && !unstopped.length) return;
                event.preventDefault();
                stopping ??= Promise.all(
                    unstopped.map((page) => stopped(page).then(() => stoppedForQuit.add(page)))
                ).then(() => {
                    stopping = null;
                    app.quit();
                });
            });
        }

        // MARK: - Public
        // The plugins running, in the person's order, each with its page and what it said it contributes once it
        // started (`summary`, null until then).
        function pages() {
            return DECK.plugins()
                .filter(({ id }) => running.has(id))
                .map((entry) => ({ entry, page: running.get(entry.id).page, summary: DECK.summaryOf(entry.id) }));
        }

        // The deckit page a webContents belongs to: a plugin's or the switcher's own, or the plugin's that shows it as
        // a web page.
        function pageFor(webContents) {
            if (IDENTITY.pluginOf(webContents) || IDENTITY.isSwitcher(webContents)) return webContents;
            return WEB.hostOf(webContents);
        }

        // Told when a plugin's page is made or closed, and when the plugin has started or ended.
        function onChange(listener) {
            listeners.add(listener);
        }

        // Every plugin stops and starts again in its page, at the page's own address, as a new theme asks. Whoever
        // requires one waits for its new run from the first.
        function reload() {
            for (const [id, { page, entry }] of running) {
                DECK.rerun(id);
                stopped(page).then(() => {
                    if (running.get(id)?.page !== page) return;
                    stoppedForQuit.delete(page);
                    page.webContents.loadURL(ORIGIN.addressOf(ORIGIN.originOf(entry.id)));
                });
            }
        }

        // MARK: - Private
        // A plugin runs as it arrives and stops as it goes; one whose folder changed stops and runs again, once its
        // old page has ended. Resolves once the pages that went have ended.
        function reconcile(plugins) {
            const ids = new Set(plugins.map(({ id }) => id));
            const ends = [];
            for (const [id, { page, entry }] of running) {
                if (
                    ids.has(id) &&
                    sameFolder(
                        entry,
                        plugins.find((plugin) => plugin.id === id)
                    )
                )
                    continue;
                running.delete(id);
                ending.add(id);
                ends.push(
                    end(page).then(() => {
                        ending.delete(id);
                        return reconcile(DECK.plugins());
                    })
                );
            }
            for (const entry of plugins) if (!running.has(entry.id) && !ending.has(entry.id)) run(entry);
            notify();
            return Promise.all(ends);
        }

        // The plugin's stop() answered, or its time ran out, or its page is already gone.
        function stopped(page) {
            if (page.webContents.isDestroyed()) return Promise.resolve();
            return PROTOCOL.stop.invoke(page.webContents, {}, { timeout: STOP_LIMIT_MS }).catch(() => {});
        }

        function end(page) {
            return stopped(page).then(() => !page.webContents.isDestroyed() && page.webContents.close());
        }

        function sameFolder(before, after) {
            return (
                before.folder === after.folder &&
                before.version === after.version &&
                before.installs === after.installs &&
                JSON.stringify(before.permissions) === JSON.stringify(after.permissions)
            );
        }

        function run(entry) {
            DECK.prepare(entry);
            const page = makePage();
            const contents = page.webContents;
            const origin = ORIGIN.originOf(entry.id);
            IDENTITY.add(contents, { plugin: entry });
            WEB.host(contents);
            KEYMAP.listen(contents);
            // Every scheme: which ones open, and how, is the scheme's handlers' to say.
            contents.setWindowOpenHandler((details) => {
                OPEN.open(details.url, WEB.windowOptions(details));
                return { action: 'deny' };
            });
            // Identity holds the page to its origin, and a link that leaves it is opened by the scheme's handlers.
            LOG.guard(contents, 'will-frame-navigate', (details) => {
                if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.open(details.url, {});
            });
            // A page that did not load runs no plugin: what loaded instead is an error page, never the plugin's origin.
            // An aborted load is one replaced by another.
            LOG.guard(contents, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
                if (isMainFrame && code !== ERR_ABORTED) DECK.ended(entry.id, `its page did not load (${description})`);
            });
            // A page that crashed ran its plugin out with it.
            LOG.guard(contents, 'render-process-gone', (_event, { reason }) =>
                DECK.ended(entry.id, `its page ended (${reason})`)
            );
            LOG.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${entry.id}: ${message}`)
            );
            // It runs at full speed off screen: it is the plugin running, not a tab put away. Chromium takes the
            // preference back at each load, so it is given again as each one finishes.
            LOG.guard(contents, 'did-finish-load', () => contents.setBackgroundThrottling(false));
            running.set(entry.id, { page, entry });
            contents.loadURL(ORIGIN.addressOf(origin));
        }

        function notify() {
            for (const listener of listeners) listener();
        }

        return { start, pages, pageFor, onChange, reload };
    }
);
