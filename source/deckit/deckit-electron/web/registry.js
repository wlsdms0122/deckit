export function createRegistry() {
    // MARK: - Property
    // page id -> { page, embedder, inPage }. page: WebKit's page. embedder: the mod's page it is shown in. inPage: an
    // element of the mod's page rather than a page in a window.
    const pages = new Map();

    // MARK: - Initializer
    // MARK: - Public
    function add(page, { embedder, inPage = false }) {
        const id = page.id;
        pages.set(id, { page, embedder, inPage });
        page.once('destroyed', () => pages.delete(id));
    }

    function get(id) {
        return pages.get(id) || null;
    }

    // The pages shown as elements of a mod's view.
    function pagesIn(embedder) {
        return [...pages.values()]
            .filter((entry) => entry.embedder === embedder && entry.inPage)
            .map(({ page }) => page);
    }

    // MARK: - Private

    return { add, get, pagesIn };
}
