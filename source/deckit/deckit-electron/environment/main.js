// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, a page is its
// webContents, in a view of its own, the core is a child process, and the log a file of its own.
import * as LISTENER from '../deck/listener/index.js';
import * as CONNECTION from '../core/connection.js';
import * as LOG_FILE from '../deck/log/file.js';
import * as ORIGIN from '../deck/sandbox/model/origin.js';
import { clearStorage, makeView, keepDrawing } from '../deck/sandbox/index.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by Electron's.
const INPUT = { keyDown: 'keydown', mouseDown: 'mousedown', mouseUp: 'mouseup' };
// Chromium's code for a load that another load replaced.
const ERR_ABORTED = -3;
const views = new WeakMap(); // a page a mod runs in, or ran in -> the view it is in, kept while the page is
const mods = new WeakMap(); // a page a mod runs in -> the mod's id

// MARK: - Initializer
// MARK: - Public
// What Electron gives deck for the host app's configuration: `core` is the core's executable, and `preload` the file
// every page of deck's loads with.
function createEnvironment({ CONFIG, core, preload }) {
    const { app } = require('electron');
    const clearStorageOf = (modId) => clearStorage(CONFIG, modId);
    // A mod's page shows the web in <webview>.
    const make = ({ mod }) => {
        const view = makeView({ CONFIG, preload, webPreferences: { webviewTag: true } });
        const page = view.webContents;
        views.set(page, view);
        mods.set(page, mod);
        page.setWindowOpenHandler(() => ({ action: 'deny' }));
        keepDrawing(page);
        return page;
    };
    return Object.freeze({
        messages,
        pages: Object.freeze({ make, load, close, isGone, watch, pin, watchInput, clearStorage: clearStorageOf }),
        core: Object.freeze({ open: (listeners) => CONNECTION.open(core, listeners) }),
        folders: Object.freeze({ user: require('os').homedir() }),
        files: Object.freeze({ readText: (file) => require('fs').promises.readFile(file, 'utf8') }),
        log: Object.freeze({ open: ({ folder, name }) => LOG_FILE.open({ folder, name }) }),
        app: Object.freeze({
            onQuit: (hold) => {
                LISTENER.guard(app, 'will-quit', (event) => hold() && event.preventDefault());
            },
            quit: () => app.quit(),
        }),
        about: Object.freeze({
            app: Object.freeze({ name: app.getName(), version: app.getVersion() }),
            engines: Object.freeze([
                Object.freeze({ name: 'Electron', version: process.versions.electron }),
                Object.freeze({ name: 'Chrome', version: process.versions.chrome }),
            ]),
        }),
    });
}

// The view a page a mod runs in, or ran in, is in.
function viewOf(page) {
    return views.get(page) || null;
}

function load(page) {
    page.loadURL(ORIGIN.addressOf(ORIGIN.originOf(mods.get(page))));
}

function close(page) {
    if (!page.isDestroyed()) page.close();
}

// A destroyed page, or one whose renderer is gone, receives nothing.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

function watch(page, { failed = null, ended = null, destroyed = null, consoleError = null } = {}) {
    if (failed)
        LISTENER.guard(page, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame && code !== ERR_ABORTED) failed(description);
        });
    if (ended) {
        // A main-frame navigation that commits replaces the document, the first load's included; one refused before
        // it commits leaves it be.
        LISTENER.guard(page, 'did-navigate', () => ended(null));
        LISTENER.guard(page, 'render-process-gone', (_event, { reason }) => ended(reason));
    }
    if (destroyed) LISTENER.guard(page, 'destroyed', () => destroyed(), { once: true });
    if (consoleError)
        LISTENER.guard(page, 'console-message', ({ level, message }) => level === 'error' && consoleError(message));
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

export { createEnvironment, viewOf };
