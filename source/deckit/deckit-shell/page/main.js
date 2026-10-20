import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// A page that runs no mod is named as a host is, with no dot, so its origin is never a mod's.
const PAGE_NAME = /^[a-z][a-z0-9-]*$/;

// The pages that run no mod, which the shell's UI draws, and what any page of deck's is to the UI: a token it keeps and
// hands back, never reads. `pages` is what the environment makes and tells of a page (environment: MAIN.pages).
export function createPage({ IDENTITY, LOG, pages }) {
    // MARK: - Property
    const surfacePages = new WeakMap(); // a surface a page opened here opened -> its leaving the opener's surfaces

    // MARK: - Initializer
    // MARK: - Public
    // A page that runs no mod, at an origin of its own for `name`, what its console says as an error logged under its
    // name. `keepsDrawing`: it lays out while hidden too. `reloadsOnCrash`: a page whose process ended is loaded
    // again. `surfaces`: `{ names, onOpen(name, page) }`, the documents it may open by `window.open('', name)`, each
    // once at a time, each laid as a page of its own that runs no code and goes nowhere; it opens nothing else.
    function open(name, { keepsDrawing = false, reloadsOnCrash = false, surfaces = null } = {}) {
        if (!PAGE_NAME.test(String(name)))
            throw new Error(`"${name}" is not a page name: a lower case letter, then letters, digits and -`);
        const page = pages.make({ name, keepsDrawing });
        IDENTITY.add(page, { page: name });
        pages.watch(page, {
            consoleError: (message) => LOG.error(`${name}: ${message}`),
            gone: reloadsOnCrash ? () => !pages.isClosed(page) && pages.load(page) : null,
        });
        const opened = new Map(); // surface name -> its page, while it is there
        if (surfaces)
            pages.surfaces(page, {
                allow: (surfaceName) => surfaces.names.includes(surfaceName) && !opened.has(surfaceName),
                opened: (surfaceName, surface) => {
                    opened.set(surfaceName, surface);
                    const leave = () => opened.get(surfaceName) === surface && opened.delete(surfaceName);
                    surfacePages.set(surface, leave);
                    pages.watch(surface, { destroyed: leave });
                    surfaces.onOpen(surfaceName, surface);
                },
            });
        pages.load(page);
        return page;
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
        if (IDENTITY.pageNameOf(page) || IDENTITY.modOf(page) || surfacePages.has(page)) return;
        throw new Error("[deckit] it takes a page of deck's: a mod's, one that runs none, or a surface one opened");
    }

    return { open, isAlive, focus, close, whenFocused };
}

// What each page deckit makes is, answered to the page as it starts. `web` is what the environment gives of the web
// (environment: MAIN.web).
export function createSetup({ IDENTITY, web }) {
    // MARK: - Property
    let attached = false; // whether the shell's UI is on deckit, so each mod's page wears it

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            return { sessions: web.sessionsOf(IDENTITY.modOf(sender).id), attached };
        });
    }

    // The shell's UI is put on deckit (`attach`): each mod's page that starts from now on is given its part.
    function attach() {
        attached = true;
    }

    // MARK: - Private

    return { start, attach };
}
