// What Electron gives deck and the shell in main (deckit-shell/environment: MAIN, SHELL): every page is WebKit's,
// through the module beside the core, laid in the module's windows, and carries the messages; Electron runs the app,
// its keys, menus and the system's services, the core is a child process, and the log a file of its own.
import * as LISTENER from '../listener/index.js';
import { createReports } from './reports.js';
import * as CONNECTION from '../core/connection.js';
import * as LOG_FILE from '../log/file.js';
import * as FILES from '../files/index.js';
import * as ORIGIN from '../sandbox/model/origin.js';
import { clearStorage, serve, storeFor } from '../sandbox/index.js';
import { createFolder } from '../mod/folder.js';
import { createWebKit } from '../webkit/index.js';
import { createMessages, CHANNEL } from '../messages/main.js';
import { createWindows } from '../window/index.js';
import { createStages } from '../stage/main.js';
import { createNotifications } from '../notification/main.js';
import { createMainProcess } from '../main-process/main.js';
import { createWeb } from '../web/main.js';

// MARK: - Property
// UI Events' names for the input deck is told of, by the module's.
const INPUT = { keyDown: 'keydown', keyUp: 'keyup', mouseDown: 'mousedown', mouseUp: 'mouseup' };
// Electron's accelerator key for each key code a spec names that is not a letter, a digit or a function key.
const ACCELERATOR_KEYS = Object.freeze({
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    Enter: 'Enter',
    Escape: 'Escape',
    Space: 'Space',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
});

// MARK: - Initializer
// MARK: - Public
// What Electron gives deck for the host app: `core` is the core's executable, `preload` the file every page of deck's
// runs in deckit's world as each of its documents starts, and `openWindow` the host app's answer for a window of the
// app's. Beside what deck is given, for the host app alone: `windows`, the windows it opens and frames, which pages are
// laid in.
function createEnvironment({ core, preload, openWindow }) {
    const { app } = require('electron');
    const REPORTS = createReports();
    let configured = null; // { id }, as deck configures it
    const CONFIG = Object.freeze({
        get id() {
            return settled().id;
        },
    });
    const guard = LISTENER.createGuard((label, error) => REPORTS.report('error', `${label} failed`, error));
    const LOG = Object.freeze({
        info: (...parts) => REPORTS.report('info', ...parts),
        warn: (...parts) => REPORTS.report('warn', ...parts),
        error: (...parts) => REPORTS.report('error', ...parts),
        guard,
    });
    const FOLDER = createFolder();
    // WebKit's module is the core's neighbour in the archive.
    const WEBKIT = createWebKit({ path: require('path').join(require('path').dirname(core), 'deckit-web.node'), LOG });
    const MESSAGES = createMessages();
    const WINDOWS = createWindows({ LOG, WEBKIT, openWindow });
    const STAGES = createStages({ LOG, WEBKIT, idOf: WINDOWS.idOf, webPagesIn: (page) => WEB.webPagesIn(page) });
    const WEB = createWeb({ CONFIG, LOG, WEBKIT, MESSAGES, STAGES, WINDOWS });
    const MAIN_PROCESS = createMainProcess({ LOG, FOLDER });
    const NOTIFICATIONS = createNotifications({ guard });
    const origins = new WeakMap(); // a page deck made -> its origin
    const mods = new WeakSet(); // the pages mods run in
    const openings = new WeakMap(); // a page -> { surfaces, opens, name }, what its window.open becomes (openingOf)
    const pins = new WeakMap(); // a pinned page -> { address }, the address its first load committed
    let answer = null; // how a load of deck's scheme is answered, once deck serves (serve)
    let script = null; // the preload's source
    hear();
    // A page that runs no mod is named as a host is, with no dot, so its origin is never a mod's. It is clear where it
    // draws nothing, as the windows it opens are.
    const make = ({ modId = null, name = null, keepsDrawing = false } = {}) => {
        const owned = modId !== null;
        const origin = owned ? ORIGIN.originOf(modId) : ORIGIN.pageOriginOf(name);
        const asked = { page: null };
        const page = WEBKIT.make({
            store: storeFor(CONFIG.id, origin),
            scheme: ORIGIN.SCHEME,
            clear: true,
            fullSpeed: owned || keepsDrawing,
            delegate: delegateOf(asked),
        });
        asked.page = page;
        origins.set(page, origin);
        if (owned) mods.add(page);
        page.run([{ source: (script ??= require('fs').readFileSync(preload, 'utf8')), world: 'deckit' }]);
        page.once('destroyed', () => {
            for (const surface of openingOf(page).opened) surface.close();
        });
        return page;
    };
    const load = (page) => page.loadURL(ORIGIN.addressOf(origins.get(page)));
    const STAGE = STAGES.stage;
    return Object.freeze({
        windows: WINDOWS.windows,
        configure,
        reports: Object.freeze({ listen: REPORTS.listen }),
        messages: MESSAGES.messages,
        pages: Object.freeze({
            make,
            load,
            close,
            focus: (page) => page.focus(),
            isGone,
            isClosed: (page) => page.isDestroyed(),
            watch: (page, watchers) => watch(guard, page, watchers, { openingOf }),
            surfaces: (page, given) => {
                openingOf(page).surfaces = given;
            },
            serve: (folderOf) => {
                answer = serve({ folderOf, FOLDER });
            },
            pin: (page) => pin(guard, page, pins),
            watchInput: (page, listener) => watchInput(guard, page, listener),
            clearStorage: (modId) => clearStorage(WEBKIT, CONFIG.id, modId),
        }),
        keys: Object.freeze({
            capture: (page, handler) => capture(guard, page, handler),
            hotkey,
            focused: () => WEBKIT.focusedPage(),
        }),
        open: Object.freeze({ url: openURL, file: openFile, reveal, appFor }),
        notifications: Object.freeze({ show: NOTIFICATIONS.show }),
        clipboard: Object.freeze({
            readText: () => require('electron').clipboard.readText(),
            writeText: (text) => require('electron').clipboard.writeText(text),
        }),
        dialogs: Object.freeze({ chooseFolder }),
        stage: STAGE,
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
            onChange: MAIN_PROCESS.onChange,
            restartPending: MAIN_PROCESS.restartPending,
        }),
        core: Object.freeze({ open: (listeners) => CONNECTION.open(core, listeners) }),
        folders: Object.freeze({ user: require('os').homedir() }),
        files: Object.freeze({
            readText: FILES.readText,
            name: FILES.name,
            fresh: FILES.fresh,
            rename: FILES.rename,
            move: FILES.move,
            trash: FILES.trash,
        }),
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
                Object.freeze({ key: 'webkit', name: 'WebKit', version: WEBKIT.native().safariVersion() || '' }),
            ]),
        }),
    });

    // What a page of deck's asks of main: a load of its scheme, its own files or a question, what it posts, where it
    // goes, and the window it opens. `asked.page` is the page, known once it is made. It is given no permission of the
    // web's and trusts no certificate the Mac does not: what a mod reaches it reaches through deck.
    function delegateOf(asked) {
        return {
            request: (request) => {
                if (request.method === 'POST') return MESSAGES.requested(asked.page, request);
                if (answer) return answer(request);
                return request.reply({ status: 404, body: '' });
            },
            message: (body) => MESSAGES.posted(asked.page, body),
            navigate: (url) => navigating(asked.page, url),
            external: (url) => leaving(asked.page, url),
            open: (opened) => opening(asked.page, opened),
            permission: () => false,
            certificate: () => false,
        };
    }

    // A mod's page asked to go outside its origin is told to what watches it leave. A pinned page stays at the address
    // its first load committed.
    function navigating(page, url) {
        if (!String(url).startsWith(origins.get(page) + '/')) leaving(page, url);
        const address = pins.get(page)?.address;
        return address && withoutFragment(url) !== address ? 'refuse' : 'load';
    }

    function leaving(page, url) {
        if (mods.has(page)) page.emit('leaves', String(url));
    }

    // What a page's window.open becomes, decided in one place a page has: a blank surface it may open by the name its
    // window.open targeted (`pages.surfaces`), or none, what it asked told to each watch hearing `opens`.
    function opening(page, { url, background }) {
        const held = openingOf(page);
        const name = held.name;
        held.name = null;
        if (name !== null && (url === '' || url === 'about:blank') && held.surfaces?.allow(name))
            return WEBKIT.listenerFor({
                delegate: SURFACE,
                opened: (surface) => {
                    held.opened.add(surface);
                    surface.once('destroyed', () => held.opened.delete(surface));
                    held.surfaces.opened(name, surface);
                },
            });
        for (const opens of held.opens) opens(String(url), { activates: !background, target: name ?? '' });
        return undefined;
    }

    function openingOf(page) {
        if (!openings.has(page))
            openings.set(page, { surfaces: null, opens: new Set(), name: null, opened: new Set() });
        return openings.get(page);
    }

    // What the pages of deck's tell main of themselves.
    function hear() {
        MESSAGES.on(CHANNEL.opening, (page, { name }) => {
            openingOf(page).name = String(name);
            return null;
        });
        MESSAGES.on(CHANNEL.opened, (page) => {
            openingOf(page).name = null;
        });
        MESSAGES.on(CHANNEL.consoleError, (page, { message }) => page.emit('console-error', String(message)));
        const windowOf = (page) => WINDOWS.idOf(STAGES.windowShowing(page));
        MESSAGES.on(CHANNEL.drag, (page) => {
            const id = windowOf(page);
            if (id !== null) WEBKIT.native().drag(id);
        });
        MESSAGES.on(CHANNEL.titleBar, (page) => {
            const id = windowOf(page);
            if (id !== null) WEBKIT.native().doubleClickTitleBar(id);
        });
    }

    function configure({ id }) {
        if (configured) throw new Error('[deckit] the environment is configured once');
        configured = Object.freeze({ id });
    }

    function settled() {
        if (!configured) throw new Error('[deckit] the environment is configured before it keeps anything');
        return configured;
    }
}

// A surface: it runs no code of its own and goes nowhere.
const SURFACE = Object.freeze({
    request: ({ reply }) => reply({ status: 404, body: '' }),
    navigate: () => 'refuse',
});

function close(page) {
    page.close();
}

// A closed page, or one whose process is gone, receives nothing.
function isGone(page) {
    return page.isDestroyed() || page.isCrashed();
}

// `openingOf(page)` is what its window.open becomes. Answers what stops this watch, and only it.
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
    { openingOf }
) {
    const added = []; // [event, listener]
    const on = (event, listener, options) => added.push([event, guard(page, event, listener, options)]);
    if (failed) on('failed', (_code, description) => failed(description));
    // A main-frame navigation that commits replaces the document, the first load's included; one refused before it
    // commits leaves it be.
    if (ended) on('committed', () => ended());
    if (gone) on('gone', () => gone('crashed'));
    if (destroyed) on('destroyed', () => destroyed(), { once: true });
    if (focused) on('focus', () => focused());
    if (consoleError) on('console-error', (message) => consoleError(message));
    if (opens) openingOf(page).opens.add(opens);
    if (leaves) on('leaves', (url) => leaves(url));
    return () => {
        for (const [event, listener] of added.splice(0)) page.removeListener(event, listener);
        if (opens) openingOf(page).opens.delete(opens);
    };
}

// A navigation keeps the page, so a page that left its address would still be taken for what it first loaded while it
// ran another's page with that one's storage, or ran its own again beside itself. So it stays at the address its
// first load commits. Main's own load and reload pass without being asked.
function pin(guard, page, pins) {
    const pinned = { address: null };
    pins.set(page, pinned);
    guard(page, 'committed', (url) => (pinned.address ??= withoutFragment(url)), { once: true });
}

// A key is told before it reaches the page, so before anything watching after this may take it; a click as it
// reaches the page.
function watchInput(guard, page, listener) {
    guard(page, 'key', (pressed) => pressed.type === 'keyDown' && listener({ type: INPUT.keyDown }));
    guard(page, 'mouse', (type) => listener({ type: INPUT[type] }));
}

// A key, told before it reaches the page, taken from it when `handler` answers true. Told after what watchInput
// watches, when that watch began first.
function capture(guard, page, handler) {
    guard(page, 'key', ({ type, code, meta, control, alt, shift }, take) => {
        const pressed = { type: INPUT[type], code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift };
        if (handler(Object.freeze(pressed))) take();
    });
}

// A key held with Electron's global shortcuts, which the system hands the app wherever it is pressed. Holding one
// already held, by this app or another, fails.
function hotkey(keystroke, handler) {
    const { globalShortcut } = require('electron');
    const accelerator = acceleratorOf(keystroke);
    if (!accelerator || globalShortcut.isRegistered(accelerator)) return null;
    if (!globalShortcut.register(accelerator, () => handler())) return null;
    let held = true;
    return () => {
        if (!held) return;
        held = false;
        globalShortcut.unregister(accelerator);
    };
}

// A key as Electron's accelerator names it, or null for a key it has no name for.
function acceleratorOf({ code, meta, control, alt, shift }) {
    const key =
        code.match(/^Key([A-Z])$/)?.[1] ||
        code.match(/^Digit([0-9])$/)?.[1] ||
        code.match(/^(F[0-9]{1,2})$/)?.[1] ||
        ACCELERATOR_KEYS[code];
    if (!key) return null;
    const modifiers = [
        [control, 'Control'],
        [alt, 'Alt'],
        [shift, 'Shift'],
        [meta, 'Super'],
    ];
    return [...modifiers.filter(([held]) => held).map(([, name]) => name), key].join('+');
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

// An app's name as a person reads it.
function appFor(url) {
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
