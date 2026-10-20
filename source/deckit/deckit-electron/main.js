import * as MAIN_PROCESS_PERMISSION from '../deckit-shell/main-process/model/permission.js';
import * as WEB_PERMISSION from './web/model/permission.js';
import * as CLIPBOARD_PERMISSION from '../deckit-shell/clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../deckit-shell/notification/model/permission.js';
import * as KEYMAP_PERMISSION from '../deckit-shell/keymap/model/permission.js';
import * as OPEN_PERMISSION from '../deckit-shell/open/model/permission.js';
import * as MOD_PERMISSION from '../deckit-shell/deck/mod/permission.js';
import * as ORIGIN from './deck/sandbox/model/origin.js';
import * as CONTRACT from './deck/contract/index.js';
import { createHome } from '../deckit-shell/deck/home/index.js';
import { createStorage } from '../deckit-shell/deck/storage/index.js';
import { createLog } from '../deckit-shell/deck/log/main.js';
import { createPermission } from '../deckit-shell/deck/mod/permission.js';
import { createFolder } from './deck/mod/folder.js';
import { createCatalog } from '../deckit-shell/deck/catalog/index.js';
import * as ENVIRONMENT from '../deckit-shell/environment/index.js';
import * as IPC from '../deckit-shell/deck/ipc/main.js';
import { createIdentity } from '../deckit-shell/deck/identity/index.js';
import { createEnvironment } from './environment/main.js';
import { createSandbox } from './deck/sandbox/index.js';
import { createRunner } from '../deckit-shell/deck/runner/main.js';
import { createRecord } from '../deckit-shell/deck/record/main.js';
import { createSetting } from '../deckit-shell/deck/setting/main.js';
import { createExport } from '../deckit-shell/deck/export/main.js';
import { createExtension } from '../deckit-shell/deck/extension/main.js';
import { createEvent } from '../deckit-shell/deck/event/main.js';
import { createMods } from '../deckit-shell/deck/mods/main.js';
import { createCore } from '../deckit-shell/deck/core/main.js';
import { createStage } from './stage/main.js';
import { createPartition } from './web/model/partition.js';
import { createSession } from './web/session.js';
import { createRegistry } from './web/registry.js';
import { createDebugger } from './web/debugger.js';
import { createAgent } from './web/agent.js';
import { createSitePermission } from './web/site-permission.js';
import { createCertificate } from './web/certificate.js';
import { createScript } from './web/script.js';
import { createWeb } from './web/main.js';
import { createKeymap } from '../deckit-shell/keymap/main.js';
import { createOpen } from '../deckit-shell/open/main.js';
import { createNotification } from '../deckit-shell/notification/main.js';
import { createClipboard } from '../deckit-shell/clipboard/main.js';
import { createCommand } from '../deckit-shell/command/main.js';
import { createMainProcess } from '../deckit-shell/main-process/main.js';
import { createModFolder } from '../deckit-shell/mod-folder/main.js';
import { createRuntime } from '../deckit-shell/runtime/main.js';
import { createPage } from './page/main.js';
import { createApi } from './api/index.js';

// MARK: - Property
// The scheme deck's pages load from, for the host app's registerSchemesAsPrivileged: Electron takes privileged schemes
// in one call, before the app is ready, so the host app makes it with this beside its own.
const SCHEME = CONTRACT.SCHEME;
// What the host app hands deckit, and what deckit makes of what it leaves out. `config`: `id` names everything deckit
// keeps, `name` is what a person reads, `agent` the names the host app adds to its user agent, taken out of a web
// page's, and `schemeHandlers`, by scheme, the mods asked first to open an address. `folders`: `home` is deckit's
// folder, ~/.config/<id> when none is given, `ship` the mod folders the host app ships, installed at every start, and
// `sources` folders of mods read in place, ahead of installed ones.
const CONFIG = { id: 'deckit', name: 'Deckit', agent: [], schemeHandlers: {} };
const FOLDERS = { home: null, ship: [], sources: [] };
// What the host app answers deckit: the windows and the process are its own.
const ANSWERS = ['openWindow', 'notificationClicked', 'restart'];
// Main's channels and its sessions' protocols are the process's: deckit connects once.
let connected = false;

// MARK: - Public
// How a host app starts deckit, once, before it is ready: `preload` is the file it put together around deckit's page
// bundles, `core` the core's executable as the archive holds it, `host` answers what of deckit is the app's, and
// `config` and `folders` are its configuration. Answers what the app and its shell reach of deckit (api/index.js).
function connect({ preload, core, host, config = {}, folders = {} } = {}) {
    if (connected) throw new Error('[deckit] connect is called once');
    const missing = ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    if (!preload) throw new Error('[deckit] connect needs the preload deckit pages load with');
    if (!core) throw new Error("[deckit] connect needs the core: the archive's deckit executable");
    refuseUnknown('config', config, Object.keys(CONFIG));
    refuseUnknown('folders', folders, Object.keys(FOLDERS));
    connected = true;
    return make({
        preload,
        core,
        host,
        config: Object.freeze({ ...CONFIG, ...config }),
        folders: Object.freeze({ ...FOLDERS, ...folders }),
    });
}

// MARK: - Private
function refuseUnknown(what, given, known) {
    if (typeof given !== 'object' || !given) throw new Error(`[deckit] ${what} is not an object`);
    const unknown = Object.keys(given).filter((key) => !known.includes(key));
    if (unknown.length) throw new Error(`[deckit] ${what} sets ${unknown.join(', ')}, which deckit does not read`);
}

// Deckit in main, made of deck's parts and its own, each handed what it uses.
function make({ preload, core, host, config: CONFIG, folders: FOLDERS }) {
    // What Electron gives deck, held to what deck is given, carrying the channels before anything crosses. The rest
    // of it is Electron's own, for what lays pages in a window.
    const ELECTRON = createEnvironment({ CONFIG, core, preload, openWindow: (options) => host.openWindow(options) });
    const ENV = ENVIRONMENT.checked(ELECTRON, ENVIRONMENT.MAIN, 'what Electron gives deck');
    const HOME = createHome({ CONFIG, FOLDERS, user: ENV.folders.user });
    // Deck's log, and listening on Electron's objects with what a listener throws logged.
    const LOG = Object.freeze({
        ...createLog({ log: ENV.log, reports: ENV.reports, about: ENV.about, folder: HOME.logs, name: CONFIG.id }),
        guard: ELECTRON.guard,
    });
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    const CORE = createCore({ CONFIG, FOLDERS, LOG, core: ENV.core, home: HOME.folder });
    const STORAGE = createStorage({ CORE, LOG });
    const PERMISSION = createPermission();
    const FOLDER = createFolder();
    const CATALOG = createCatalog({ CORE, LOG, files: ENV.files });
    const IDENTITY = createIdentity({ pages: ENV.pages });
    const SANDBOX = createSandbox({ CONFIG, IDENTITY, CATALOG, FOLDER, LOG });
    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: ENV.pages, app: ENV.app });
    const RECORD = createRecord({ CORE, IDENTITY });
    const SETTING = createSetting({ CORE, LOG, IDENTITY, RUNNER });
    const EXPORT = createExport({ CORE, IDENTITY, RUNNER });
    const EXTENSION = createExtension({ CORE, IDENTITY, RUNNER });
    const EVENT = createEvent({ CORE, LOG, IDENTITY });
    const MODS = createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, STORAGE, RECORD, EXTENSION, pages: ENV.pages });
    const WINDOW = ELECTRON.window;
    const PARTITION = createPartition({ CONFIG });
    const SESSION = createSession({ STORAGE, LOG, PARTITION });
    const REGISTRY = createRegistry();
    const DEBUGGER = createDebugger({ LOG });
    const AGENT = createAgent({ CONFIG, DEBUGGER, LOG });
    const SITE_PERMISSION = createSitePermission({ IDENTITY, SESSION, REGISTRY });
    const CERTIFICATE = createCertificate({ LOG, SESSION, REGISTRY });
    const SCRIPT = createScript({ LOG, DEBUGGER, SESSION, SITE_PERMISSION });
    const KEYMAP = createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE, pages: ENV.pages, keys: ENV.keys });
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
    const OPEN = createOpen({ LOG, IDENTITY, CORE, open: ENV.open });
    const NOTIFICATION = createNotification({
        LOG,
        IDENTITY,
        clicked: () => host.notificationClicked(),
        notifications: ENV.notifications,
    });
    const CLIPBOARD = createClipboard({ IDENTITY, clipboard: ENV.clipboard });
    const COMMAND = createCommand({ LOG, IDENTITY, CORE });
    const MAIN_PROCESS = createMainProcess({ IDENTITY, RUNNER, HOME, mainProcess: ENV.mainProcess });
    const MOD_FOLDER = createModFolder({ IDENTITY, CATALOG, MODS, dialogs: ENV.dialogs, open: ENV.open });
    const RUNTIME = createRuntime({
        CONFIG,
        HOME,
        LOG,
        IDENTITY,
        restart: () => host.restart(),
        about: ENV.about,
        user: ENV.folders.user,
    });
    const PAGE = createPage({ IDENTITY, PARTITION, SANDBOX, LOG, modViewOf: ELECTRON.viewOf });
    const STAGE = createStage({ LOG, WINDOW, viewOf: PAGE.viewOf });
    const API = createApi({
        CONFIG,
        STORAGE,
        LOG,
        WINDOW,
        IDENTITY,
        CATALOG,
        RUNNER,
        PERMISSION,
        WEB,
        KEYMAP,
        COMMAND,
        MAIN_PROCESS,
        PAGE,
        STAGE,
    });
    const starting = []; // what starts with deckit, before any mod launches: the shell on it
    let started = false;

    // What deck and each of deckit's concepts grant, in the order a person reads them.
    for (const model of [
        MOD_PERMISSION,
        MAIN_PROCESS_PERMISSION,
        WEB_PERMISSION,
        CLIPBOARD_PERMISSION,
        NOTIFICATION_PERMISSION,
        KEYMAP_PERMISSION,
        OPEN_PERMISSION,
    ])
        for (const permission of model.PERMISSIONS) PERMISSION.define(permission);
    // What connect answers is made, and held to what a layer is given, before anything starts.
    const answer = API.make({ onStart });
    require('electron')
        .app.whenReady()
        .then(() => start(preload));
    return answer;

    // `listener` is told once, as deckit starts once the app is ready, before any mod launches. It is handed over
    // before then.
    function onStart(listener) {
        if (started) throw new Error('[deckit] what starts with deckit is handed over before the app is ready');
        starting.push(listener);
    }

    // The log starts first, then the core, which is handed the permissions the layers defined and hands over the
    // state it keeps, and installs what the host app ships and reads the mods, before anything reads the mods or the
    // state. What follows the mods' runs starts before the runner launches any.
    async function start(preload) {
        LOG.start({
            nameOf: (page) => IDENTITY.modOf(page)?.id || IDENTITY.pageNameOf(page) || 'page',
        });
        CORE.start({ permissions: PERMISSION.all() });
        await STORAGE.load();
        await CATALOG.load();
        SANDBOX.start({ preload });
        WEB.start();
        KEYMAP.start();
        OPEN.start();
        NOTIFICATION.start();
        CLIPBOARD.start();
        MAIN_PROCESS.start();
        MOD_FOLDER.start();
        RUNTIME.start();
        PAGE.start();
        started = true;
        // What fails to start with deckit fails alone: the mods run whatever it did.
        for (const listener of starting) {
            try {
                listener();
            } catch (error) {
                LOG.error('what starts with deckit did not start', error);
            }
        }
        RECORD.start();
        SETTING.start();
        EXPORT.start();
        EXTENSION.start();
        EVENT.start();
        MODS.start({
            facts: (mod) => ({ mainProcess: MAIN_PROCESS.stateOf(mod.id) }),
            onFactsChange: MAIN_PROCESS.onChange,
            installed: MAIN_PROCESS.installed,
            removed: MAIN_PROCESS.removed,
            clearSessions: SESSION.clearSessions,
        });
        RUNNER.start({ preparePage });
    }

    // A mod's page shows the web, hears the key map, and offers what it opens to the scheme's handlers: a window it
    // asks for, and a link that leaves its origin, which deck holds it to.
    function preparePage(webContents, mod) {
        WEB.prepareEmbedder(webContents);
        KEYMAP.listen(webContents, { page: WEB.pageFor(webContents) });
        webContents.setWindowOpenHandler((details) => {
            OPEN.openFrom(webContents, details.url, WEB.windowOptions(details));
            return { action: 'deny' };
        });
        const origin = ORIGIN.originOf(mod.id);
        LOG.guard(webContents, 'will-frame-navigate', (details) => {
            if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.openFrom(webContents, details.url);
        });
    }
}

export { SCHEME, connect };
