export function createRegistry() {
    // MARK: - Property
    // page webContents id -> { embedder, tab, inPage }. embedder: the mod's page it is shown in. tab: the id of the
    // page whose delegate answers for it, itself or the page that opened it. inPage: an element of the mod's page
    // rather than a window.
    const pages = new Map();

    // MARK: - Initializer
    // MARK: - Public
    function add(page, { embedder, tab, inPage = false }) {
        const id = page.id;
        pages.set(id, { embedder, tab, inPage });
        page.once('destroyed', () => pages.delete(id));
    }

    function get(id) {
        return pages.get(id) || null;
    }

    // The page whose delegate answers for this one, and the mod's page showing it.
    function tabOf(page) {
        const entry = pages.get(page.id);
        if (!entry) return null;
        const tab = require('electron').webContents.fromId(entry.tab);
        return tab && !tab.isDestroyed() ? { embedder: entry.embedder, tab } : null;
    }

    // The pages shown as elements of a mod's view.
    function pagesIn(embedder) {
        const { webContents } = require('electron');
        return [...pages]
            .filter(([id, entry]) => entry.embedder === embedder && entry.inPage && entry.tab === id)
            .map(([id]) => webContents.fromId(id))
            .filter(Boolean);
    }

    // MARK: - Private

    return { add, get, tabOf, pagesIn };
}
