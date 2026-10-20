// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, a page is its
// webContents, the core is a child process, and the folders and the log are HOME's.
import * as LISTENER from '../deck/listener/index.js';
import * as CONNECTION from '../core/connection.js';
import * as LOG_FILE from '../deck/log/file.js';
import { clearStorage } from '../deck/sandbox/index.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by Electron's.
const INPUT = { keyDown: 'keydown', mouseDown: 'mousedown', mouseUp: 'mouseup' };

// MARK: - Initializer
// MARK: - Public
// What Electron gives deck for the host app's configuration: `HOME` its folders, `core` the core's executable.
function createEnvironment({ CONFIG, HOME, core }) {
    return Object.freeze({
        messages,
        pages: Object.freeze({ isGone, watch, pin, watchInput }),
        core: Object.freeze({ open: (listeners) => CONNECTION.open(core, listeners) }),
        folders: Object.freeze({ home: HOME.folder }),
        files: Object.freeze({ readText: (file) => require('fs').promises.readFile(file, 'utf8') }),
        log: Object.freeze({ open: () => LOG_FILE.open({ folder: HOME.logs, name: CONFIG.id }) }),
        about,
        storage: Object.freeze({ clear: (modId) => clearStorage(CONFIG, modId) }),
    });
}

// The app and Electron, each with its version.
function about() {
    const { app } = require('electron');
    return { app: `${app.getName()} ${app.getVersion()}`, engine: `Electron ${process.versions.electron}` };
}

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

// MARK: - Private
function withoutFragment(url) {
    return String(url).split('#')[0];
}

export { createEnvironment };
