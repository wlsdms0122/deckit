// What Electron gives deck on main's side (deckit-shell/environment: MAIN): its IPC carries the messages, a page is its
// webContents, in a view of its own, the core is a child process, and the log a file of its own.
import * as LISTENER from '../listener/index.js';
import * as HANDLER from '../handler/index.js';
import { createReports } from './reports.js';
import * as CONNECTION from '../core/connection.js';
import * as LOG_FILE from '../log/file.js';
import * as ORIGIN from '../sandbox/model/origin.js';
import { clearStorage, makeView, keepDrawing, serve } from '../sandbox/index.js';
import { createFolder } from '../mod/folder.js';
import { createWindow } from '../window/index.js';
import { createStage } from '../stage/main.js';
import { createNotifications } from '../notification/main.js';
import { createMainProcess } from '../main-process/main.js';
import { createWeb, windowOptions } from '../web/main.js';
import { messages } from '../messages/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by Electron's.
const INPUT = { keyDown: 'keydown', keyUp: 'keyup', mouseDown: 'mousedown', mouseUp: 'mouseup' };
// Chromium's code for a load that another load replaced.
const ERR_ABORTED = -3;
// Chromium's own schemes: its pages, its extensions' and its tools'.
const CHROMIUM_SCHEMES = Object.freeze(['chrome', 'chrome-extension', 'devtools', 'view-source']);

// MARK: - Initializer
// MARK: - Public
// What Electron gives deck for the host app: `core` is the core's executable, `preload` the file every page of deck's
// loads with, and `openWindow` the host app's answer for a window. Beside what deck is given, Electron's own, for the
// host app alone: `viewOf(page)`, the view a page of deck's, or a surface, is in, `owns(webContents)`, whether a
// webContents is one of deckit's, `window.place`, how a view is put in one of the host app's windows, and `guard`, how a
// listener on Electron's emitters is added, reported as what Electron's parts say is.
function createEnvironment({ core, preload, openWindow }) {
    const { app } = require('electron');
    const REPORTS = createReports();
    let configured = null; // { id, agent }, as deck configures it
    const CONFIG = Object.freeze({
        get id() {
            return settled().id;
        },
        get agent() {
            return settled().agent;
        },
    });
    const guard = LISTENER.createGuard((label, error) => REPORTS.report('error', `${label} failed`, error));
    const LOG = Object.freeze({
        info: (...parts) => REPORTS.report('info', ...parts),
        warn: (...parts) => REPORTS.report('warn', ...parts),
        error: (...parts) => REPORTS.report('error', ...parts),
        guard,
    });
    const hold = HANDLER.createHold((setter) =>
        REPORTS.report('warn', `${setter} on a webContents or session of deckit's: left as deckit set it`)
    );
    const WINDOW = createWindow({ LOG, openWindow });
    const MAIN_PROCESS = createMainProcess({ WINDOW, LOG, FOLDER: createFolder() });
    const NOTIFICATIONS = createNotifications({ guard });
    MAIN_PROCESS.holdQuit();
    // A page deck made, or a surface one opened -> the view it is in, kept while the page is.
    const views = new WeakMap();
    const origins = new WeakMap(); // a page deck made -> its origin
    const mods = new WeakSet(); // the pages mods run in
    const openings = new WeakMap(); // a page -> { surfaces, opens }, what its window.open becomes (openingOf)
    let making = 0; // how many of deckit's webContents are being made now
    const WEB = createWeb({ CONFIG, LOG, WINDOW, made, claim, hold });
    const FOLDER = createFolder();
    // A mod's page shows the web in <webview>; one that runs no mod is named as a host is, with no dot, so its origin
    // is never a mod's.
    const make = ({ modId = null, name = null, keepsDrawing = false } = {}) => {
        const owned = modId !== null;
        const view = made(() =>
            makeView({ id: CONFIG.id, preload, webPreferences: owned ? { webviewTag: true } : {} })
        );
        const page = view.webContents;
        views.set(page, view);
        origins.set(page, owned ? ORIGIN.originOf(modId) : ORIGIN.pageOriginOf(name));
        if (owned) mods.add(page);
        openingOf(page);
        if (owned || keepsDrawing) keepDrawing(page, guard);
        return page;
    };
    const load = (page) => page.loadURL(ORIGIN.addressOf(origins.get(page)));
    const viewOf = (page) => views.get(page) || null;
    // A page deck made, a web page a mod shows, and what one of those opened: their handlers and guards are deckit's.
    // Told from the moment Electron tells of the webContents, before deckit has set anything on it: one made while
    // deckit makes or claims one, one shown in a page of deckit's, or one a page of deckit's opened.
    const owns = (page) => {
        if (making > 0 || views.has(page) || WEB.has(page)) return true;
        const { webContents } = require('electron');
        const by = page.hostWebContents || (page.opener && webContents.fromFrame(page.opener));
        return !!by && by !== page && owns(by);
    };
    const STAGE = createStage({ LOG, WINDOW, viewOf });
    return Object.freeze({
        viewOf,
        owns,
        window: Object.freeze({ place: WINDOW.place }),
        guard,
        configure,
        reports: Object.freeze({ listen: REPORTS.listen }),
        messages,
        pages: Object.freeze({
            make,
            load,
            close,
            focus: (page) => page.focus(),
            isGone,
            isClosed: (page) => page.isDestroyed(),
            watch: (page, watchers) =>
                watch(guard, page, watchers, { origin: mods.has(page) ? origins.get(page) : null, openingOf }),
            surfaces: (page, given) => {
                openingOf(page).surfaces = given;
            },
            serve: (folderOf) => serve({ id: CONFIG.id, folderOf, FOLDER, hold }),
            pin: (page) => pin(guard, page),
            watchInput: (page, listener) => watchInput(guard, page, listener),
            clearStorage: (modId) => clearStorage(CONFIG.id, modId),
        }),
        keys: Object.freeze({ capture: (page, handler) => capture(guard, page, handler) }),
        open: Object.freeze({ url: openURL, file: openFile, reveal, appFor }),
        notifications: Object.freeze({ show: NOTIFICATIONS.show }),
        clipboard: Object.freeze({
            readText: () => require('electron').clipboard.readText(),
            writeText: (text) => require('electron').clipboard.writeText(text),
        }),
        dialogs: Object.freeze({ chooseFolder }),
        stage: STAGE.stage,
        web: Object.freeze({
            listen: WEB.listen,
            embed: WEB.embed,
            pageOf: WEB.pageOf,
            holderOf: WEB.holderOf,
            holdsKeyboard: WEB.holdsKeyboard,
            openWindow: WEB.openWindow,
            load: WEB.load,
            navigate: WEB.navigate,
            setMuted: WEB.setMuted,
            find: WEB.find,
            stopFind: WEB.stopFind,
            close: WEB.close,
            stateOf: WEB.stateOf,
            clickNotification: WEB.clickNotification,
            sessionOf: WEB.sessionOf,
            permissionsChanged: WEB.permissionsChanged,
            fetchText: WEB.fetchText,
            clear: WEB.clear,
            trust: WEB.trust,
            sessionsOf: WEB.sessionsOf,
        }),
        mainProcess: Object.freeze({
            start: MAIN_PROCESS.start,
            call: MAIN_PROCESS.call,
            launching: MAIN_PROCESS.launching,
            ended: MAIN_PROCESS.ended,
            removed: MAIN_PROCESS.removed,
            installed: MAIN_PROCESS.installed,
            stateOf: MAIN_PROCESS.stateOf,
            onEvent: MAIN_PROCESS.onEvent,
            onChange: MAIN_PROCESS.onChange,
            restartPending: MAIN_PROCESS.restartPending,
        }),
        core: Object.freeze({ open: (listeners) => CONNECTION.open(core, listeners) }),
        folders: Object.freeze({ user: require('os').homedir() }),
        files: Object.freeze({ readText: (file) => require('fs').promises.readFile(file, 'utf8') }),
        log: Object.freeze({ open: ({ folder, name }) => LOG_FILE.open({ folder, name }) }),
        app: Object.freeze({
            whenReady: () => app.whenReady(),
            onQuit: (hold) => {
                guard(app, 'will-quit', (event) => hold() && event.preventDefault());
            },
            quit: () => app.quit(),
        }),
        about: Object.freeze({
            app: Object.freeze({ name: app.getName(), version: app.getVersion() }),
            engines: Object.freeze([
                Object.freeze({ key: 'electron', name: 'Electron', version: process.versions.electron }),
                Object.freeze({ key: 'chrome', name: 'Chrome', version: process.versions.chrome }),
            ]),
        }),
    });

    // What a page's window.open becomes, decided in one place a page has: a surface it may open (`pages.surfaces`), or
    // none, what it asked told to each watch hearing `opens`.
    function openingOf(page) {
        if (openings.has(page)) return openings.get(page);
        const opening = { surfaces: null, opens: new Set() };
        openings.set(page, opening);
        hold(page, 'setWindowOpenHandler', (details) => {
            const name = details.frameName;
            if (opening.surfaces?.allow(name))
                return {
                    action: 'allow',
                    createWindow: (options) => openSurface(name, options.webContents, opening.surfaces.opened),
                };
            for (const opens of opening.opens) opens(details.url, windowOptions(details));
            return { action: 'deny' };
        });
        return opening;
    }

    // A surface a page opened: in a view of its own, it runs no code and goes nowhere.
    function openSurface(name, surface, opened) {
        const { WebContentsView } = require('electron');
        views.set(surface, new WebContentsView({ webContents: surface }));
        hold(surface, 'setWindowOpenHandler', () => ({ action: 'deny' }));
        guard(surface, 'will-frame-navigate', (details) => details.preventDefault());
        opened(name, surface);
        return surface;
    }

    // What Electron makes from now until `release()` is called is deckit's, as Electron tells of it then.
    function claim() {
        making += 1;
        let held = true;
        return () => {
            if (!held) return;
            held = false;
            making -= 1;
        };
    }

    // What `make()` answers, made as one of deckit's webContents.
    function made(make) {
        const release = claim();
        try {
            return make();
        } finally {
            release();
        }
    }

    function configure({ id, agent }) {
        if (configured) throw new Error('[deckit] the environment is configured once');
        configured = Object.freeze({ id, agent: Object.freeze([...agent]) });
    }

    function settled() {
        if (!configured) throw new Error('[deckit] the environment is configured before it keeps anything');
        return configured;
    }
}

function close(page) {
    if (!page.isDestroyed()) page.close();
}

// A destroyed page, or one whose renderer is gone, receives nothing.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

// `origin` is the page's own, a mod's, for what leaves it, and `openingOf(page)` what its window.open becomes. Answers
// what stops this watch, and only it.
function watch(
    guard,
    page,
    {
        failed = null,
        ended = null,
        gone = null,
        destroyed = null,
        focused = null,
        consoleError = null,
        opens = null,
        leaves = null,
    } = {},
    { origin, openingOf }
) {
    const added = []; // [event, listener]
    const on = (event, listener, options) => added.push([event, guard(page, event, listener, options)]);
    if (failed)
        on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame && code !== ERR_ABORTED) failed(description);
        });
    // A main-frame navigation that commits replaces the document, the first load's included; one refused before it
    // commits leaves it be.
    if (ended) on('did-navigate', () => ended());
    if (gone) on('render-process-gone', (_event, { reason }) => gone(reason));
    if (destroyed) on('destroyed', () => destroyed(), { once: true });
    if (focused) on('focus', () => focused());
    if (consoleError) on('console-message', ({ level, message }) => level === 'error' && consoleError(message));
    if (opens) openingOf(page).opens.add(opens);
    if (leaves && origin)
        on('will-frame-navigate', (details) => {
            if (details.isMainFrame && !details.url.startsWith(origin + '/')) leaves(details.url);
        });
    return () => {
        for (const [event, listener] of added.splice(0)) page.removeListener(event, listener);
        if (opens) openingOf(page).opens.delete(opens);
    };
}

// A navigation keeps the page, so a page that left its address would still be known as its owner while it ran
// another's page with that one's storage, or ran its own again beside itself. So it stays at the address its first
// load commits. Main's own loadURL and reload pass without these events.
function pin(guard, page) {
    let address = null;
    guard(page, 'did-navigate', (_event, url) => (address ??= withoutFragment(url)), { once: true });
    const leaves = (details) => details.isMainFrame && withoutFragment(details.url) !== address;
    guard(page, 'will-frame-navigate', (details) => leaves(details) && details.preventDefault());
    guard(page, 'will-redirect', (details) => leaves(details) && details.preventDefault());
}

// A key is told before it reaches the page, so before anything watching after this may take it; a click after it
// reached the page.
function watchInput(guard, page, listener) {
    guard(page, 'before-input-event', (_event, input) => input.type === 'keyDown' && listener({ type: INPUT.keyDown }));
    guard(page, 'input-event', (_event, input) => {
        if (input.type === 'mouseDown' || input.type === 'mouseUp') listener({ type: INPUT[input.type] });
    });
}

// A key, told before it reaches the page, taken from it when `handler` answers true. Told after what watchInput
// watches, when that watch began first.
function capture(guard, page, handler) {
    guard(page, 'before-input-event', (event, { type, code, meta, control, alt, shift }) => {
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

// An app's name as a person reads it. Chromium's own schemes open in no app.
function appFor(url) {
    const scheme = String(url).split(':')[0].toLowerCase();
    if (CHROMIUM_SCHEMES.includes(scheme)) return '';
    return require('electron')
        .app.getApplicationNameForProtocol(String(url))
        .replace(/\.app$/i, '');
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
