import * as CHANNEL from '../../deckit-shell/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The pages that run no mod, which a layer on deckit draws, and what any page of deck's is to that layer: a token it
// keeps and hands back, never reads.
export function createPage({ IDENTITY, PARTITION, SANDBOX, RUNNER, LOG }) {
    // MARK: - Property
    const views = new WeakMap(); // a page opened here, or a surface one opened -> the view it is in
    const surfacePages = new WeakMap(); // a surface a page opened here opened -> its leaving the opener's surfaces

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            // What a mod's page needs of the configuration, worked out here: how its web sessions are spelled.
            return { sessionPrefix: PARTITION.prefixOf(IDENTITY.modOf(sender).id) };
        });
    }

    // A page that runs no mod, at `deckit://<name>/`, what its console says as an error logged under its name.
    // `keepsDrawing`: it lays out while hidden too. `reloadsOnCrash`: a renderer that crashed is loaded again.
    // `surfaces`: `{ names, onOpen(name, page) }`, the documents it may open by `window.open('', name)`, each once at
    // a time, each laid as a page of its own that runs no code and goes nowhere; it opens nothing else.
    function open(name, { keepsDrawing = false, reloadsOnCrash = false, surfaces = null } = {}) {
        const view = SANDBOX.page(name);
        const page = view.webContents;
        views.set(page, view);
        if (keepsDrawing) SANDBOX.keepDrawing(page);
        if (reloadsOnCrash) LOG.guard(page, 'render-process-gone', () => !page.isDestroyed() && page.reload());
        const opened = new Map(); // surface name -> its page, while it is there
        page.setWindowOpenHandler(({ frameName }) =>
            surfaces?.names.includes(frameName) && !opened.has(frameName)
                ? { action: 'allow', createWindow: (options) => openSurface(frameName, options.webContents) }
                : { action: 'deny' }
        );
        return page;

        function openSurface(surfaceName, surface) {
            const { WebContentsView } = require('electron');
            views.set(surface, new WebContentsView({ webContents: surface }));
            opened.set(surfaceName, surface);
            const leave = () => opened.get(surfaceName) === surface && opened.delete(surfaceName);
            surfacePages.set(surface, leave);
            surface.setWindowOpenHandler(() => ({ action: 'deny' }));
            LOG.guard(surface, 'will-frame-navigate', (details) => details.preventDefault());
            LOG.guard(surface, 'destroyed', leave, { once: true });
            surfaces.onOpen(surfaceName, surface);
            return surface;
        }
    }

    // The view a page of deck's is in: one opened here, a surface one opened, or a mod's.
    function viewOf(page) {
        return views.get(page) || RUNNER.viewOf(page);
    }

    // Whether the page is still there: it is gone once it is closed.
    function isAlive(page) {
        if (page.isDestroyed()) return false;
        known(page);
        return true;
    }

    function focus(page) {
        if (isAlive(page)) page.focus();
    }

    // A surface closed leaves its opener's surfaces at once, so the opener may open it again.
    function close(page) {
        if (!isAlive(page)) return;
        surfacePages.get(page)?.();
        page.close();
    }

    // Heard each time the page takes the keyboard: answers its off.
    function whenFocused(page, listener) {
        known(page);
        const guarded = LOG.guard(page, 'focus', () => listener());
        return () => page.removeListener('focus', guarded);
    }

    // MARK: - Private
    // A page of deck's (a mod's, or one that runs none) or a surface one opened: any other is refused.
    function known(page) {
        if (IDENTITY.pageNameOf(page) || IDENTITY.modOf(page) || surfacePages.has(page)) return;
        throw new Error("[deckit] it takes a page of deck's: a mod's, one that runs none, or a surface one opened");
    }

    return { start, open, viewOf, isAlive, focus, close, whenFocused };
}
