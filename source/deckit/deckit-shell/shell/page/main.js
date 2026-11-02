// A page that runs no mod is named as a host is, with no dot, so its origin is never a mod's.
const PAGE_NAME = /^[a-z][a-z0-9-]*$/;

// The pages that run no mod, which the shell's UI draws, and what any page of deck's is to the UI: a token it keeps and
// hands back, never reads. A page it makes is told deck as the host app's, by its name. `deckit` is what connect
// answered, and `pages` what the environment makes and tells of a page (environment: SHELL.pages).
export function createPage({ deckit, pages }) {
    // MARK: - Property
    // A page -> { allowed: surface name -> onOpen(surface), opened: surface name -> its page, while it is there }
    const openable = new WeakMap();
    const surfacePages = new WeakMap(); // a surface a page opened -> its leaving the opener's surfaces

    // MARK: - Initializer
    // MARK: - Public
    // A page that runs no mod, at an origin of its own for `name`, what its console says as an error logged under its
    // name. `keepsDrawing`: it lays out while hidden too. `reloadsOnCrash`: a page whose process ended is loaded
    // again. `surfaces`: `{ names, onOpen(name, page) }`, the surfaces it may open (allowSurface).
    function open(name, { keepsDrawing = false, reloadsOnCrash = false, surfaces = null } = {}) {
        if (!PAGE_NAME.test(String(name)))
            throw new Error(`"${name}" is not a page name: a lower case letter, then letters, digits and -`);
        const page = pages.make({ name, keepsDrawing });
        deckit.pages.add(page, name);
        pages.watch(page, {
            consoleError: (message) => deckit.log.error(`${name}: ${message}`),
            gone: reloadsOnCrash ? () => !pages.isClosed(page) && pages.load(page) : null,
        });
        for (const surfaceName of surfaces?.names || [])
            allowSurface(page, surfaceName, (surface) => surfaces.onOpen(surfaceName, surface));
        pages.load(page);
        return page;
    }

    // A page of deck's may open the document `name` by `window.open('', name)`, one at a time: a page of its own,
    // laid as any page is, that runs no code and goes nowhere, `onOpen(surface)` told once it is open. Allowed again,
    // `onOpen` is the one told from then on. What else the page asks for is no window.
    function allowSurface(page, name, onOpen) {
        known(page);
        let held = openable.get(page);
        if (!held) {
            held = { allowed: new Map(), opened: new Map() };
            openable.set(page, held);
            const { allowed, opened } = held;
            pages.surfaces(page, {
                allow: (surfaceName) => allowed.has(surfaceName) && !opened.has(surfaceName),
                opened: (surfaceName, surface) => {
                    opened.set(surfaceName, surface);
                    const leave = () => opened.get(surfaceName) === surface && opened.delete(surfaceName);
                    surfacePages.set(surface, leave);
                    pages.watch(surface, { destroyed: leave });
                    allowed.get(surfaceName)(surface);
                },
            });
        }
        held.allowed.set(name, onOpen);
    }

    // Whether the page is still there: it is gone once it is closed.
    function isAlive(page) {
        if (pages.isClosed(page)) return false;
        known(page);
        return true;
    }

    function focus(page) {
        if (isAlive(page)) pages.focus(page);
    }

    // A surface closed leaves its opener's surfaces at once, so the opener may open it again.
    function close(page) {
        if (!isAlive(page)) return;
        surfacePages.get(page)?.();
        pages.close(page);
    }

    // Heard each time the page takes the keyboard: answers its off.
    function whenFocused(page, listener) {
        known(page);
        return pages.watch(page, { focused: () => listener() });
    }

    // MARK: - Private
    // A page of deck's (a mod's, or one that runs none) or a surface one opened: any other is refused.
    function known(page) {
        if (deckit.pages.nameOf(page) || deckit.mods.modOf(page) || surfacePages.has(page)) return;
        throw new Error("[deckit] it takes a page of deck's: a mod's, one that runs none, or a surface one opened");
    }

    // The paths of the files last dropped on the page from outside the app.
    function droppedFiles(page) {
        return isAlive(page) ? pages.droppedFiles(page) : [];
    }

    return { open, allowSurface, isAlive, focus, close, whenFocused, droppedFiles };
}
