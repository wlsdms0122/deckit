// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, a page is its
// webContents, in a view of its own, the core is a child process, and the log a file of its own.
import * as LISTENER from '../deck/listener/index.js';
import * as CONNECTION from '../core/connection.js';
import * as LOG_FILE from '../deck/log/file.js';
import * as ORIGIN from '../deck/sandbox/model/origin.js';
import { clearStorage, makeView, keepDrawing } from '../deck/sandbox/index.js';
import { createFolder } from '../deck/mod/folder.js';
import { createWindow } from '../window/index.js';
import { createNotifications } from '../notification/main.js';
import { createMainProcess } from '../main-process/main.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by Electron's.
const INPUT = { keyDown: 'keydown', keyUp: 'keyup', mouseDown: 'mousedown', mouseUp: 'mouseup' };
// Chromium's code for a load that another load replaced.
const ERR_ABORTED = -3;

// MARK: - Initializer
// MARK: - Public
// What Electron gives deck for the host app's configuration: `core` is the core's executable, `preload` the file
// every page of deck's loads with, `openWindow` the host app's answer for a window, and `log` where what Electron's
// own parts say is logged. `viewOf(page)`, the view a mod's page is in, and `window`, the windows deckit opens, are
// Electron's own, beside what deck is given, for what lays pages in a window.
function createEnvironment({ CONFIG, core, preload, openWindow, log }) {
    const { app } = require('electron');
    const WINDOW = createWindow({ LOG: log, openWindow });
    const MAIN_PROCESS = createMainProcess({ WINDOW, LOG: log, FOLDER: createFolder() });
    const NOTIFICATIONS = createNotifications();
    MAIN_PROCESS.holdQuit();
    const views = new WeakMap(); // a page a mod runs in, or ran in -> the view it is in, kept while the page is
    const mods = new WeakMap(); // a page a mod runs in -> the mod's id
    const clearStorageOf = (modId) => clearStorage(CONFIG, modId);
    // A mod's page shows the web in <webview>.
    const make = ({ modId }) => {
        const view = makeView({ CONFIG, preload, webPreferences: { webviewTag: true } });
        const page = view.webContents;
        views.set(page, view);
        mods.set(page, modId);
        page.setWindowOpenHandler(() => ({ action: 'deny' }));
        keepDrawing(page);
        return page;
    };
    const load = (page) => page.loadURL(ORIGIN.addressOf(ORIGIN.originOf(mods.get(page))));
    const viewOf = (page) => views.get(page) || null;
    return Object.freeze({
        viewOf,
        window: WINDOW,
        messages,
        pages: Object.freeze({ make, load, close, isGone, watch, pin, watchInput, clearStorage: clearStorageOf }),
        keys: Object.freeze({ capture }),
        open: Object.freeze({ url: openURL, file: openFile, reveal }),
        notifications: Object.freeze({ show: NOTIFICATIONS.show }),
        clipboard: Object.freeze({
            readText: () => require('electron').clipboard.readText(),
            writeText: (text) => require('electron').clipboard.writeText(text),
        }),
        dialogs: Object.freeze({ chooseFolder }),
        mainProcess: Object.freeze({
            start: MAIN_PROCESS.start,
            call: MAIN_PROCESS.call,
            prepare: MAIN_PROCESS.prepare,
            end: MAIN_PROCESS.end,
            unload: MAIN_PROCESS.unload,
            onEvent: MAIN_PROCESS.onEvent,
            onChange: MAIN_PROCESS.onChange,
            whenEnded: MAIN_PROCESS.whenEnded,
            started: MAIN_PROCESS.started,
            failure: MAIN_PROCESS.failure,
            restartPending: MAIN_PROCESS.restartPending,
            reinstalled: MAIN_PROCESS.reinstalled,
        }),
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

function close(page) {
    if (!page.isDestroyed()) page.close();
}

// A destroyed page, or one whose renderer is gone, receives nothing.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

function watch(page, { failed = null, ended = null, gone = null, destroyed = null, consoleError = null } = {}) {
    if (failed)
        LISTENER.guard(page, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame && code !== ERR_ABORTED) failed(description);
        });
    // A main-frame navigation that commits replaces the document, the first load's included; one refused before it
    // commits leaves it be.
    if (ended) LISTENER.guard(page, 'did-navigate', () => ended());
    if (gone) LISTENER.guard(page, 'render-process-gone', (_event, { reason }) => gone(reason));
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

// A key, told before it reaches the page, taken from it when `handler` answers true. Told after what watchInput
// watches, when that watch began first.
function capture(page, handler) {
    LISTENER.guard(page, 'before-input-event', (event, { type, code, meta, control, alt, shift }) => {
        const kind = INPUT[type] || String(type).toLowerCase();
        const pressed = { type: kind, code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift };
        if (handler(Object.freeze(pressed))) event.preventDefault();
    });
}

function openURL(url, { activate = true } = {}) {
    return require('electron').shell.openExternal(url, { activate });
}

async function openFile(file) {
    const found = existing(file);
    return !!found && !(await require('electron').shell.openPath(found));
}

function reveal(file) {
    const found = existing(file);
    if (found) require('electron').shell.showItemInFolder(found);
    return !!found;
}

async function chooseFolder({ title, buttonLabel, message }) {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({ title, buttonLabel, message, properties: ['openDirectory'] });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

// MARK: - Private
// The file an absolute path names, if there is one there; '' otherwise.
function existing(file) {
    const path = require('path');
    if (!path.isAbsolute(String(file))) return '';
    const resolved = path.resolve(file);
    return require('fs').existsSync(resolved) ? resolved : '';
}

function withoutFragment(url) {
    return String(url).split('#')[0];
}

export { createEnvironment };
