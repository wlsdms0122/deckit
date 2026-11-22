// What Electron gives deck, the web engine and the shell in main (deckit-shell/environment: MAIN, WEB, SHELL), and
// what runs a mod's main process modules (`mainProcess`, main-process/loader.js): every page is WebKit's, through the
// module beside the core, laid in the module's windows, and carries the messages; Electron runs the app, its keys,
// menus and the system's services, the core is a child process, and the log a file of its own.
import * as LISTENER from '../listener/index.js';
import { createReports } from './reports.js';
import * as CONNECTION from '../core/connection.js';
import * as SOCKET from '../socket/main.js';
import * as LOG_FILE from '../log/file.js';
import * as FILES from '../files/index.js';
import * as ORIGIN from '../sandbox/model/origin.js';
import { clearStorage, countStorage, serve, storeFor } from '../sandbox/index.js';
import { createFolder } from '../mod/folder.js';
import { createWebKit } from '../webkit/index.js';
import { createMessages, CHANNEL } from '../messages/main.js';
import { createWindows } from '../window/index.js';
import { createStages } from '../stage/main.js';
import { createNotifications } from '../notification/main.js';
import { createLoader } from '../main-process/loader.js';
import { createWeb } from '../web/main.js';
import { createRead, SCRIPT as READER } from '../read/main.js';

// MARK: - Property
const FRAME = 16; // ms
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
    const READ = createRead({ LOG });
    // WebKit's module is the core's neighbour in the archive.
    const WEBKIT = createWebKit({
        path: require('path').join(require('path').dirname(core), 'deckit-web.node'),
        folder: require('electron').app.getPath('userData'),
        LOG,
        containerOf: (page) => WEB.containerOf(page),
        always: [READER],
        posted: READ.told,
        copied: (text, source) => {
            for (const listener of [...copying]) {
                try {
                    listener(Object.freeze({ text, source }));
                } catch (error) {
                    LOG.error('a listener of a copy failed', error);
                }
            }
        },
    });
    const MESSAGES = createMessages();
    const WINDOWS = createWindows({ LOG, WEBKIT, openWindow });
    const STAGES = createStages({ LOG, WEBKIT, idOf: WINDOWS.idOf, webPagesIn: (page) => WEB.webPagesIn(page) });
    const WEB = createWeb({ CONFIG, LOG, WEBKIT, MESSAGES, STAGES, WINDOWS, surfaceOf, asking });
    const LOADER = createLoader({ LOG, FOLDER, windowShowing });
    const NOTIFICATIONS = createNotifications({ guard });
    const origins = new WeakMap(); // a page deck made -> its origin
    const mods = new WeakSet(); // the pages mods run in
    // a page -> { surfaces, opens, name, opened }, what its window.open becomes (openingOf), `opened` the surfaces
    // open, by name
    const openings = new WeakMap();
    const pins = new WeakMap(); // a pinned page -> { address }, the address its first load committed
    let answer = null; // how a load of deck's scheme is answered, once deck serves (serve)
    let script = null; // the preload's source
    let dialogs = null; // what answers every page's dialog, once given (pages.dialogs)
    const hearing = new Set(); // what hears the machine's input (listen)
    const copying = new Set(); // what hears the text of a copy or cut key put into a page (copied)
    const moved = { last: null, timer: null }; // the move not told yet
    let hardware; // the source of the machine's own pointer and keyboard, once told (machine)
    hear();
    // A page that runs no mod is named as a host is, with no dot, so its origin is never a mod's. It is clear where it
    // draws nothing, as the windows it opens are. Every page has the keyboard only as it is given it or pressed, as the
    // windows it opens do: its document focusing an element takes it from nothing.
    const make = ({ modId = null, name = null, keepsDrawing = false } = {}) => {
        const owned = modId !== null;
        const origin = owned ? ORIGIN.originOf(modId) : ORIGIN.pageOriginOf(name);
        const asked = { page: null };
        const page = WEBKIT.make({
            store: storeFor(CONFIG.id, origin),
            scheme: ORIGIN.SCHEME,
            clear: true,
            takesKeyboard: false,
            fullSpeed: owned || keepsDrawing,
            delegate: delegateOf(asked),
        });
        asked.page = page;
        origins.set(page, origin);
        if (owned) mods.add(page);
        page.run([{ source: (script ??= require('fs').readFileSync(preload, 'utf8')), world: 'deckit' }]);
        page.once('destroyed', () => {
            for (const surface of openingOf(page).opened.values()) surface.close();
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
            droppedFiles: (page) => page.droppedFiles(),
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
            countStorage: (modId) => countStorage(WEBKIT, CONFIG.id, modId),
            dialogs: (answer) => {
                dialogs = answer;
            },
        }),
        keys: Object.freeze({
            capture: (page, handler) => capture(guard, page, handler, sourceOf),
            unhandled: (page, handler) => unhandled(guard, page, handler, sourceOf),
            hotkey,
            focused: () => WEBKIT.focusedPage(),
            reserve: (page, on) => void (page.isDestroyed() || WEBKIT.native().reserveKeyboard(page.id, !!on)),
        }),
        input: Object.freeze({ listen, put, machine, copied }),
        read: Object.freeze({
            outline: READ.outline,
            node: READ.node,
            changes: READ.changes,
            place: READ.place,
            listen: READ.listen,
        }),
        open: Object.freeze({ url: openURL, file: openFile, appFor }),
        notifications: Object.freeze({ show: NOTIFICATIONS.show }),
        admission: Object.freeze({ ask: askToSit }),
        clipboard: Object.freeze({
            readText: () => require('electron').clipboard.readText(),
            writeText: (text) => require('electron').clipboard.writeText(text),
        }),
        dialogs: Object.freeze({ chooseFolders }),
        reveal,
        stage: STAGE,
        fonts: () => WEBKIT.native().fonts(),
        // What the person set a double click on a title bar to do: `zoom`, `minimize` or `none`, as read at each call.
        actionOnDoubleClick: () => WEBKIT.native().actionOnDoubleClick(),
        web: Object.freeze({
            listen: WEB.listen,
            embed: WEB.embed,
            pageOf: WEB.pageOf,
            holderOf: WEB.holderOf,
            placeOf: WEB.placeOf,
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
            untaken: WEB.untaken,
            sessionOf: WEB.sessionOf,
            permissionsChanged: WEB.permissionsChanged,
            fetch: WEB.fetch,
            clear: WEB.clear,
            cancelDownload: WEB.cancelDownload,
            trust: WEB.trust,
            trusts: WEB.trusts,
            distrust: WEB.distrust,
            sessionsOf: WEB.sessionsOf,
        }),
        // Read by attachMainProcess alone (main-process/main.js).
        mainProcess: Object.freeze({
            start: LOADER.start,
            call: LOADER.call,
            launching: LOADER.launching,
            ended: LOADER.ended,
            removed: LOADER.removed,
            installed: LOADER.installed,
            statusOf: LOADER.statusOf,
            onChange: LOADER.onChange,
            restartPending: LOADER.restartPending,
        }),
        core: Object.freeze({ open: (listeners) => CONNECTION.open(core, listeners) }),
        transport: Object.freeze({
            listen: (where, listeners) => {
                const listener = SOCKET.listen(where, listeners);
                app.once('quit', listener.close);
                return listener;
            },
        }),
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
            // The engine drops a quit asked while it decides one, as a hold may ask it: it is asked once that is decided.
            quit: () => setImmediate(() => app.quit()),
        }),
        about: Object.freeze({
            app: Object.freeze({ name: app.getName(), version: app.getVersion() }),
            engines: Object.freeze([
                Object.freeze({ key: 'electron', name: 'Electron', version: process.versions.electron }),
                Object.freeze({ key: 'webkit', name: 'WebKit', version: WEBKIT.native().safariVersion() || '' }),
            ]),
        }),
    });

    // The machine's pointer and keyboard, each event told as the app has it, `{ event: 'pointer', type, x, y, button,
    // buttons, modifiers, count, dx, dy }` or `{ event: 'key', type, code, key, modifiers, repeat }`, with `page`, the
    // page it is delivered to, the point from that page's top left, or null and the point from its window's content's,
    // and `carried: true`: the page has it already. Moves are told once a frame, the last of them, and before whatever
    // follows them. Answers its off.
    function listen(handler) {
        if (!hearing.size) WEBKIT.native().listenInput((_name, event) => heard(event));
        hearing.add(handler);
        return () => hearing.delete(handler);
    }

    function heard(event) {
        const told = Object.freeze({
            ...event,
            page: event.page === null ? null : WEBKIT.pageById(event.page),
            carried: true,
        });
        if (told.event === 'pointer' && told.type === 'move') {
            moved.last = told;
            moved.timer ??= setTimeout(flush, FRAME);
            return;
        }
        flush();
        tell(told);
    }

    function flush() {
        clearTimeout(moved.timer);
        const last = moved.last;
        moved.timer = null;
        moved.last = null;
        if (last) tell(last);
    }

    function tell(event) {
        for (const listener of [...hearing]) {
            try {
                listener(event);
            } catch (error) {
                LOG.error('a listener of the input failed', error);
            }
        }
    }

    // `event`, as `listen` tells one, `{ event: 'text', type, text }`, `type` `insert`, `compose`, `commit` or
    // `cancel`, or `{ event: 'clipboard', type: 'paste', text }`, with `source`, an opaque word of the caller's for the
    // devices it came from, put into `page` at a point from its top left: the page is not given the keyboard, what the
    // page tells of the event carries `source`, and a key the page does not handle is told as its own unhandled key and
    // reaches nothing else.
    function put(page, event) {
        if (typeof event?.source !== 'string' || !event.source)
            throw new Error('[deckit] an event is put with a source');
        if (isGone(page)) return;
        WEBKIT.native().putInput(page.id, event);
    }

    // `handler({ text, source })` hears the text of each copy or cut key put into a page with `source`: what the page
    // set for it, or else what is selected. Answers its off.
    function copied(handler) {
        copying.add(handler);
        return () => copying.delete(handler);
    }

    // The source of the machine's own pointer and keyboard from now on: what a page tells of a key of theirs carries
    // it.
    function machine(source) {
        if (typeof source !== 'string' || !source) throw new Error("[deckit] the machine's source is a word");
        hardware = source;
    }

    // The source of what a page told: the one an event was put with, or the machine's.
    function sourceOf(source) {
        return source ?? hardware;
    }

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
            dialog: asking,
        };
    }

    // A page's dialog, answered by the one answer `pages.dialogs` gave, refused where none was given.
    function asking(page, question) {
        return dialogs ? dialogs(page, question) : undefined;
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
                delegate: { ...SURFACE, dialog: asking },
                opened: (surface) => {
                    held.opened.set(name, surface);
                    surface.once('destroyed', () => held.opened.get(name) === surface && held.opened.delete(name));
                    held.surfaces.opened(name, surface);
                },
            });
        for (const opens of held.opens) opens(String(url), { activates: !background, target: name ?? '' });
        return undefined;
    }

    function openingOf(page) {
        if (!openings.has(page))
            openings.set(page, { surfaces: null, opens: new Set(), name: null, opened: new Map() });
        return openings.get(page);
    }

    // The surface `page` opened by `name`, while it is open, or null.
    function surfaceOf(page, name) {
        return openings.get(page)?.opened.get(name) || null;
    }

    // The window a page is shown in, or one a surface it opened is shown in, or null.
    function windowShowing(page) {
        const surfaces = [...(openings.get(page)?.opened.values() || [])];
        return [page, ...surfaces].map(STAGES.windowShowing).find(Boolean) || null;
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
        // A drag region's press, in the page or in the surface it names.
        const windowOf = (page, { surface }) => {
            const shown = surface === undefined ? page : surfaceOf(page, String(surface));
            return shown ? WINDOWS.idOf(STAGES.windowShowing(shown)) : null;
        };
        MESSAGES.on(CHANNEL.drag, (page, body) => {
            const id = windowOf(page, body);
            if (id !== null) WEBKIT.native().drag(id);
        });
        MESSAGES.on(CHANNEL.titleBar, (page, body) => {
            const id = windowOf(page, body);
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
// watches, when that watch began first. Its `source` is the one it was put with, or the machine's (`sourceOf`).
function capture(guard, page, handler, sourceOf) {
    guard(page, 'key', ({ type, code, meta, control, alt, shift, source }, take) => {
        const held = { meta: !!meta, control: !!control, alt: !!alt, shift: !!shift };
        if (handler(Object.freeze({ type: INPUT[type], code, ...held, source: sourceOf(source) }))) take();
    });
}

// A key down the page did not handle, told after the page had it, taken from the rest of the app when `handler`
// answers true.
function unhandled(guard, page, handler, sourceOf) {
    guard(page, 'unhandled', ({ code, meta, control, alt, shift, source }, take) => {
        const held = { meta: !!meta, control: !!control, alt: !!alt, shift: !!shift };
        if (handler(Object.freeze({ code, ...held, source: sourceOf(source) }))) take();
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

// Opened by its address, so that `activate` brings the app that opens it forward as it does for `url`.
async function openFile(file, { activate = true } = {}) {
    const found = existing(file);
    if (!found) return false;
    try {
        await require('electron').shell.openExternal(require('url').pathToFileURL(found).href, { activate });
        return true;
    } catch {
        return false;
    }
}

function reveal(file) {
    const found = existing(file);
    if (found) require('electron').shell.showItemInFolder(found);
}

// An app's name as a person reads it.
function appFor(url) {
    return require('electron')
        .app.getApplicationNameForProtocol(String(url))
        .replace(/\.app$/i, '');
}

async function chooseFolders({ title, buttonLabel, message, multiple = false }) {
    const { dialog } = require('electron');
    const properties = multiple ? ['openDirectory', 'multiSelections'] : ['openDirectory'];
    const result = await dialog.showOpenDialog({ title, buttonLabel, message, properties });
    return result.canceled ? [] : result.filePaths;
}

// A message box of the machine's, with the user's name: Allow answers yes, and Deny, or the box put away, no.
async function askToSit({ user }, { signal }) {
    const { dialog } = require('electron');
    const { response } = await dialog.showMessageBox({
        message: `${user.name} asks to sit`,
        buttons: ['Deny', 'Allow'],
        defaultId: 0,
        cancelId: 0,
        signal,
    });
    return response === 1 && !signal.aborted;
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
