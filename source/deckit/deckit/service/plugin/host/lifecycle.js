DeckitModule.define(
    'deckit/service/plugin/host/lifecycle',
    {
        uses: [
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
        ],
        provides: ['start', 'pages', 'pageFor', 'onChange', 'reload'],
        runs: 'main',
    },
    (LOG, IDENTITY, HOST, WEB, KEYMAP, OPEN) => {
        // MARK: - Property
        const running = new Map(); // plugin id -> { page, entry }
        const listeners = new Set();
        let makePage = null;

        // MARK: - Initializer
        // Every plugin that loads runs in a page of its own, whether or not it has anything to show. `makePage()` makes
        // the view a page runs in.
        function start({ makePage: make }) {
            makePage = make;
            HOST.onChange(reconcile);
            HOST.onStatus(notify);
            reconcile(HOST.plugins());
        }

        // MARK: - Public
        // The plugins running, in the person's order, each with its page and what it said it contributes once it
        // started (`summary`, null until then).
        function pages() {
            return HOST.plugins()
                .filter(({ id }) => running.has(id))
                .map((entry) => ({ entry, page: running.get(entry.id).page, summary: HOST.summaryOf(entry.id) }));
        }

        // The deckit page a webContents belongs to: a plugin's or the switcher's own, or the plugin's that shows it as
        // a web page.
        function pageFor(webContents) {
            if (IDENTITY.pluginOf(webContents) || IDENTITY.isSwitcher(webContents)) return webContents;
            return WEB.hostOf(webContents);
        }

        // Told when a plugin's page is made or closed, and when the plugin has started or ended without starting.
        function onChange(listener) {
            listeners.add(listener);
        }

        // Every plugin starts again in its page, as a new theme asks.
        function reload() {
            for (const { page } of running.values()) page.webContents.reload();
        }

        // MARK: - Private
        // A plugin runs as it arrives and stops as it goes; one whose folder changed runs again.
        function reconcile(plugins) {
            const ids = new Set(plugins.map(({ id }) => id));
            for (const [id, { page }] of running) {
                if (ids.has(id)) continue;
                page.webContents.close();
                running.delete(id);
            }
            for (const entry of plugins) {
                const known = running.get(entry.id);
                if (known && sameFolder(known.entry, entry)) continue;
                if (known) known.page.webContents.close();
                run(entry);
            }
            notify();
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
            HOST.prepare(entry);
            const page = makePage();
            const contents = page.webContents;
            const origin = IDENTITY.originOf(entry.id);
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
            LOG.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${entry.id}: ${message}`)
            );
            running.set(entry.id, { page, entry });
            contents.loadURL(origin + '/');
        }

        function notify() {
            for (const listener of listeners) listener();
        }

        return { start, pages, pageFor, onChange, reload };
    }
);
