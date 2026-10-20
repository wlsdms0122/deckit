// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, and a page
// is its webContents.
import * as LISTENER from '../deck/listener/index.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by Electron's.
const INPUT = { keyDown: 'keydown', mouseDown: 'mousedown', mouseUp: 'mouseup' };

// MARK: - Initializer
// MARK: - Public
// A destroyed page, or one whose renderer is gone, receives nothing.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

// Each listener is added to the page as it is handed here, so what watches a page is told in the order it began to.
function watch(page, { ended = null, destroyed = null } = {}) {
    if (ended) {
        // A main-frame navigation that commits replaces the document, the first load's included; one refused before
        // it commits leaves it be.
        LISTENER.guard(page, 'did-navigate', () => ended());
        LISTENER.guard(page, 'render-process-gone', () => ended());
    }
    if (destroyed) LISTENER.guard(page, 'destroyed', () => destroyed(), { once: true });
}

// A navigation keeps the page, so a page that left its address would still be known as its owner while it ran
// another's page with that one's storage, or ran its own again beside itself. So it stays at the address its first
// load commits. Main's own loadURL and reload pass without these events.
function pin(page) {
    let address = null;
    LISTENER.guard(page, 'did-navigate', (_event, url) => (address ??= withoutFragment(url)), { once: true });
    const leaves = (details) => details.isMainFrame && withoutFragment(details.url) !== address;
    LISTENER.guard(page, 'will-frame-navigate', (details) => leaves(details) && details.preventDefault());
    LISTENER.guard(page, 'will-redirect', (details) => leaves(details) && details.preventDefault());
}

// A key is told before it reaches the page, so before anything watching after this may take it; a click after it
// reached the page.
function watchInput(page, listener) {
    LISTENER.guard(
        page,
        'before-input-event',
        (_event, input) => input.type === 'keyDown' && listener({ type: INPUT.keyDown })
    );
    LISTENER.guard(page, 'input-event', (_event, input) => {
        if (input.type === 'mouseDown' || input.type === 'mouseUp') listener({ type: INPUT[input.type] });
    });
}

const environment = Object.freeze({ messages, pages: Object.freeze({ isGone, watch, pin, watchInput }) });

// MARK: - Private
function withoutFragment(url) {
    return String(url).split('#')[0];
}

export { environment };
