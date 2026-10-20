import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The pages that run no mod, which a layer on deckit draws, and what any page of deck's is to that layer: a token it
// keeps and hands back, never reads.
export function createPage({ IDENTITY, PARTITION, SANDBOX, LOG }) {
    // MARK: - Property
    const views = new WeakMap(); // a page opened here -> the view it is in, for the host app to place

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

    // A page that runs no mod, at `deckit://<name>/`. `keepsDrawing`: it lays out while hidden too, which Chromium takes
    // back at each load, so it is given again as each finishes. `reloadsOnCrash`: a renderer that crashed is loaded
    // again. `logAs`: its console's errors go to deckit's log under that name.
    function open(name, { keepsDrawing = false, reloadsOnCrash = false, logAs = '' } = {}) {
        const view = SANDBOX.page(name);
        const page = view.webContents;
        views.set(page, view);
        if (keepsDrawing) LOG.guard(page, 'did-finish-load', () => page.setBackgroundThrottling(false));
        if (reloadsOnCrash) LOG.guard(page, 'render-process-gone', () => !page.isDestroyed() && page.reload());
        if (logAs)
            LOG.guard(
                page,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${logAs}: ${message}`)
            );
        return page;
    }

    // The view a page opened here is in, until the host app places pages otherwise.
    function viewOf(page) {
        return views.get(page) || null;
    }

    // Whether the page is still there: it is gone once it is closed.
    function isAlive(page) {
        return !page.isDestroyed();
    }

    function focus(page) {
        if (isAlive(page)) page.focus();
    }

    // Heard each time the page takes the keyboard, starts loading, or is gone: each answers its off.
    function onFocus(page, listener) {
        return offOf(
            page,
            'focus',
            LOG.guard(page, 'focus', () => listener())
        );
    }

    function onLoad(page, listener) {
        return offOf(
            page,
            'did-start-loading',
            LOG.guard(page, 'did-start-loading', () => listener())
        );
    }

    function onGone(page, listener) {
        return offOf(
            page,
            'destroyed',
            LOG.guard(page, 'destroyed', () => listener(), { once: true })
        );
    }

    // MARK: - Private
    function offOf(page, event, guarded) {
        return () => page.removeListener(event, guarded);
    }

    return { start, open, viewOf, isAlive, focus, onFocus, onLoad, onGone };
}
