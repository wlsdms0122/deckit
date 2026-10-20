// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, and a page
// is its webContents.
import * as LISTENER from '../../deckit-shell/deck/listener/index.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A page's renderer gone, or the page itself.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

// Each listener is added to the page as it is handed here, so what watches a page is told in the order it began to.
function watch(page, { ended = null, destroyed = null } = {}) {
    if (ended) {
        // A main-frame navigation that commits replaces the document; one refused before it commits leaves it be.
        LISTENER.guard(page, 'did-navigate', () => ended());
        LISTENER.guard(page, 'render-process-gone', () => ended());
    }
    if (destroyed) LISTENER.guard(page, 'destroyed', () => destroyed(), { once: true });
}

// A key is told before it reaches the page, so before anything watching after this may take it; a click after it
// reached the page.
function watchInput(page, listener) {
    LISTENER.guard(
        page,
        'before-input-event',
        (_event, input) => input.type === 'keyDown' && listener({ type: 'keyDown' })
    );
    LISTENER.guard(page, 'input-event', (_event, input) => {
        if (input.type === 'mouseDown' || input.type === 'mouseUp') listener({ type: input.type });
    });
}

const environment = Object.freeze({ messages, pages: Object.freeze({ isGone, watch, watchInput }) });

// MARK: - Private

export { environment };
