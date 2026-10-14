DeckitModule.define(
    'deckit/service/web/registry',
    {
        uses: [],
        provides: ['add', 'get', 'tabOf', 'isTab', 'pagesIn'],
        runs: 'main',
    },
    () => {
        // MARK: - Property
        // page webContents id -> { host, mod, tab, inPage }. host: the mod's page it answers to. tab: the
        // id of the page whose delegate answers for it, itself or the page that opened it. inPage: an element of the
        // mod's page rather than a window.
        const pages = new Map();

        // MARK: - Initializer
        // MARK: - Public
        function add(page, { host, mod, tab, inPage = false }) {
            const id = page.id;
            pages.set(id, { host, mod, tab, inPage });
            page.once('destroyed', () => pages.delete(id));
        }

        function get(id) {
            return pages.get(id) || null;
        }

        // The page whose delegate answers for this one, and the view it is in.
        function tabOf(page) {
            const entry = pages.get(page.id);
            if (!entry) return null;
            const tab = require('electron').webContents.fromId(entry.tab);
            return tab && !tab.isDestroyed() ? { host: entry.host, mod: entry.mod, tab } : null;
        }

        function isTab(id) {
            return pages.get(id)?.tab === id;
        }

        // The pages shown as elements of a mod's view.
        function pagesIn(host) {
            const { webContents } = require('electron');
            return [...pages]
                .filter(([id, entry]) => entry.host === host && entry.inPage && entry.tab === id)
                .map(([id]) => webContents.fromId(id))
                .filter(Boolean);
        }

        // MARK: - Private

        return { add, get, tabOf, isTab, pagesIn };
    }
);
