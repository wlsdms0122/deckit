import * as PROTOCOL from './protocol.js';
import * as PERMISSIONS from './model/permission.js';
import * as SCHEMES from './open/model/scheme.js';
import * as DECK from '../deck/main.js';
import { createWindow } from './window/index.js';
import { createPartition } from './web/model/partition.js';
import { createSession } from './web/session.js';
import { createRegistry } from './web/registry.js';
import { createDebugger } from './web/debugger.js';
import { createAgent } from './web/agent.js';
import { createSitePermission } from './web/site-permission.js';
import { createCertificate } from './web/certificate.js';
import { createScript } from './web/script.js';
import { createWeb } from './web/main.js';
import { createKeymap } from './keymap/main.js';
import { createOpen } from './open/main.js';
import { createNotification } from './notification/main.js';
import { createClipboard } from './clipboard/main.js';
import { createCommand } from './command/main.js';
import { createMainProcess } from './main-process/main.js';
import { createModFolder } from './mod-folder/main.js';
import { createRuntime } from './runtime/main.js';
import { createApi } from './api.js';

// MARK: - Property
// The scheme deck's pages load from, for the host app's registerSchemesAsPrivileged: Electron takes privileged schemes
// in one call, before the app is ready, so the host app makes it with this beside its own.
const SCHEME = DECK.SCHEME;
// What the host app hands deckit, and what deckit makes of what it leaves out. `config` is read by deck and deckit:
// `id` names everything deckit keeps, `name` is what a person reads, `agent` the names the host app adds to its user
// agent, taken out of a web page's, and `schemeHandlers`, by scheme, the mods asked first to open an address.
// `folders` is deck's: `home`, `ship` and `sources`.
const CONFIG = { id: 'deckit', name: 'Deckit', agent: [], schemeHandlers: {} };
const FOLDERS = ['home', 'ship', 'sources'];
// What the host app answers deckit: the windows and the process are its own.
const ANSWERS = ['openWindow', 'notificationClicked', 'restart'];
// Main's channels and its sessions' protocols are the process's: deckit connects once.
let connected = false;

// MARK: - Public
// How a host app starts deckit, once, before it is ready: `preload` is the file it put together around deckit's page
// bundles, `host` answers what of deckit is the app's, and `config` and `folders` are its configuration. Answers what
// the app and its shell reach of deckit (api.js).
function connect({ preload, host, config = {}, folders = {} } = {}) {
    if (connected) throw new Error('[deckit] connect is called once');
    const missing = ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    if (!preload) throw new Error('[deckit] connect needs the preload deckit pages load with');
    refuseUnknown('config', config, Object.keys(CONFIG));
    refuseUnknown('folders', folders, FOLDERS);
    connected = true;
    return make({ preload, host, config: Object.freeze({ ...CONFIG, ...config }), folders });
}

// MARK: - Private
function refuseUnknown(what, given, known) {
    const unknown = Object.keys(given).filter((key) => !known.includes(key));
    if (unknown.length) throw new Error(`[deckit] ${what} sets ${unknown.join(', ')}, which deckit does not read`);
}

// Deckit in main, made of deck and its own parts, each handed what it uses.
function make({ preload, host, config: CONFIG, folders }) {
    const deck = DECK.createDeck({ id: CONFIG.id, ...folders });
    const { log: LOG, home: HOME, storage: STORAGE, identity: IDENTITY, catalog: CATALOG, runner: RUNNER } = deck;
    const { manifest: MANIFEST, permission: MOD_PERMISSION, folder: FOLDER } = deck;
    const WINDOW = createWindow({ LOG });
    const PARTITION = createPartition({ CONFIG });
    const SESSION = createSession({ STORAGE, LOG, PARTITION });
    const REGISTRY = createRegistry();
    const DEBUGGER = createDebugger({ LOG });
    const AGENT = createAgent({ CONFIG, DEBUGGER, LOG });
    const SITE_PERMISSION = createSitePermission({ IDENTITY, SESSION, REGISTRY });
    const CERTIFICATE = createCertificate({ LOG, SESSION, REGISTRY });
    const SCRIPT = createScript({ LOG, DEBUGGER, SESSION, SITE_PERMISSION });
    const KEYMAP = createKeymap({ CONFIG, STORAGE, LOG, IDENTITY, CATALOG, RUNNER });
    const WEB = createWeb({
        WINDOW,
        LOG,
        KEYMAP,
        IDENTITY,
        SESSION,
        REGISTRY,
        PARTITION,
        AGENT,
        SITE_PERMISSION,
        CERTIFICATE,
        SCRIPT,
    });
    const OPEN = createOpen({ CONFIG, STORAGE, LOG, IDENTITY, CATALOG, RUNNER });
    const NOTIFICATION = createNotification({ LOG, IDENTITY });
    const CLIPBOARD = createClipboard({ IDENTITY });
    const COMMAND = createCommand({ LOG, IDENTITY, CATALOG, RUNNER });
    const MAIN_PROCESS = createMainProcess({ STORAGE, WINDOW, LOG, IDENTITY, RUNNER, FOLDER });
    const MOD_FOLDER = createModFolder({ IDENTITY, CATALOG, deck });
    const RUNTIME = createRuntime({ CONFIG, HOME, LOG, IDENTITY });
    const API = createApi({
        CONFIG,
        HOME,
        LOG,
        WINDOW,
        IDENTITY,
        CATALOG,
        RUNNER,
        MANIFEST,
        MOD_PERMISSION,
        WEB,
        KEYMAP,
        COMMAND,
    });
    const starting = []; // what starts with deckit, before any mod launches: the shell on it
    let started = false;

    for (const permission of PERMISSIONS.PERMISSIONS)
        MOD_PERMISSION.define(permission, {
            before: permission.id.startsWith('system.') ? PERMISSIONS.WIDER_THAN : null,
        });
    MANIFEST.define(SCHEMES.FIELD, SCHEMES.field());
    require('electron')
        .app.whenReady()
        .then(() => start(preload, host));
    return API.make({ makeView: deck.view, onStart });

    // `listener` is told once, as deckit starts once the app is ready, before any mod launches. It is handed over
    // before then.
    function onStart(listener) {
        if (started) throw new Error('[deckit] what starts with deckit is handed over before the app is ready');
        starting.push(listener);
    }

    function start(preload, host) {
        deck.prepare({ preload });
        WINDOW.start({ openWindow: (options) => host.openWindow(options) });
        WEB.start();
        KEYMAP.start();
        OPEN.start();
        NOTIFICATION.start({ clicked: () => host.notificationClicked() });
        CLIPBOARD.start();
        COMMAND.start();
        MAIN_PROCESS.start();
        MOD_FOLDER.start();
        RUNTIME.start({ restart: () => host.restart() });
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            return page ? { page } : { id: CONFIG.id };
        });
        KEYMAP.connect({ pageFor: WEB.pageFor });
        started = true;
        // What fails to start with deckit fails alone: the mods run whatever it did.
        for (const listener of starting) {
            try {
                listener();
            } catch (error) {
                LOG.error('what starts with deckit did not start', error);
            }
        }
        deck.start({
            preparePage,
            describe: (mod) => ({
                mainProcess: { running: MAIN_PROCESS.started(mod.id), failure: MAIN_PROCESS.failure(mod.id) },
            }),
            installed: (id) => {
                MAIN_PROCESS.restartFor(id);
                return { restart: MAIN_PROCESS.restartPending().some((pending) => pending.id === id) };
            },
            removed: MAIN_PROCESS.unload,
            clearSessions: SESSION.clearSessions,
        });
    }

    // A mod's page shows the web, hears the key map, and offers what it opens to the scheme's handlers: a window it
    // asks for, and a link that leaves its origin, which deck holds it to.
    function preparePage(webContents, mod) {
        WEB.prepareEmbedder(webContents);
        KEYMAP.listen(webContents);
        const pressed = () => ({ userInitiated: IDENTITY.consumeUserActivation(webContents) });
        webContents.setWindowOpenHandler((details) => {
            OPEN.open(details.url, { ...WEB.windowOptions(details), ...pressed() });
            return { action: 'deny' };
        });
        const origin = DECK.originOf(mod.id);
        LOG.guard(webContents, 'will-frame-navigate', (details) => {
            if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.open(details.url, pressed());
        });
    }
}

export { SCHEME, connect };
