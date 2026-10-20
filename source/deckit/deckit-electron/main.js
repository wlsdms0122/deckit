import * as MAIN_PROCESS_PERMISSION from './main-process/model/permission.js';
import * as WEB_PERMISSION from './web/model/permission.js';
import * as CLIPBOARD_PERMISSION from './clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from './notification/model/permission.js';
import * as KEYMAP_PERMISSION from './keymap/model/permission.js';
import * as OPEN_PERMISSION from './open/model/permission.js';
import * as MOD_PERMISSION from './deck/mod/permission.js';
import * as ORIGIN from './deck/sandbox/model/origin.js';
import { createHome } from './deck/storage/home.js';
import { createStorage } from './deck/storage/index.js';
import { createLog } from './deck/log/main.js';
import { createPermission } from './deck/mod/permission.js';
import { createFolder } from './deck/mod/folder.js';
import { createCatalog } from './deck/catalog/index.js';
import * as ENVIRONMENT from '../deckit-shell/environment/index.js';
import * as IPC from '../deckit-shell/deck/ipc/main.js';
import { createIdentity } from '../deckit-shell/deck/identity/index.js';
import { environment } from './environment/main.js';
import { createSandbox } from './deck/sandbox/index.js';
import { createRunner } from './deck/runner/main.js';
import { createRecord } from './deck/record/main.js';
import { createSetting } from './deck/setting/main.js';
import { createExport } from './deck/export/main.js';
import { createExtension } from './deck/extension/main.js';
import { createEvent } from './deck/event/main.js';
import { createMods } from './deck/mods/main.js';
import { createCore } from './core/main.js';
import { createWindow } from './window/index.js';
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
import { createKeymap } from './keymap/main.js';
import { createOpen } from './open/main.js';
import { createNotification } from './notification/main.js';
import { createClipboard } from './clipboard/main.js';
import { createCommand } from './command/main.js';
import { createMainProcess } from './main-process/main.js';
import { createModFolder } from './mod-folder/main.js';
import { createRuntime } from './runtime/main.js';
import { createPage } from './page/main.js';
import { createApi } from './api/index.js';

// MARK: - Property
// The scheme deck's pages load from, for the host app's registerSchemesAsPrivileged: Electron takes privileged schemes
// in one call, before the app is ready, so the host app makes it with this beside its own.
const SCHEME = ORIGIN.SCHEME;
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
    // What Electron gives deck, held to what deck is given, carrying the channels before anything crosses.
    const ENV = ENVIRONMENT.checked(environment, ENVIRONMENT.MAIN, 'what Electron gives deck');
    IPC.carry(ENV);
    const HOME = createHome({ CONFIG, FOLDERS });
    const LOG = createLog({ CONFIG, HOME });
    const CORE = createCore({ CONFIG, FOLDERS, HOME, LOG, core });
    const STORAGE = createStorage({ HOME, CORE, LOG });
    const PERMISSION = createPermission();
    const FOLDER = createFolder();
    const CATALOG = createCatalog({ CORE, LOG });
    const IDENTITY = createIdentity({ pages: ENV.pages });
    const SANDBOX = createSandbox({ CONFIG, IDENTITY, CATALOG, FOLDER, LOG });
    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, SANDBOX, CORE });
    const RECORD = createRecord({ CORE, IDENTITY });
    const SETTING = createSetting({ CORE, LOG, IDENTITY, RUNNER });
    const EXPORT = createExport({ CORE, IDENTITY, RUNNER });
    const EXTENSION = createExtension({ CORE, IDENTITY, RUNNER });
    const EVENT = createEvent({ CORE, LOG, IDENTITY });
    const MODS = createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, SANDBOX, STORAGE, RECORD, EXTENSION });
    const WINDOW = createWindow({ LOG, openWindow: (options) => host.openWindow(options) });
    const PARTITION = createPartition({ CONFIG });
    const SESSION = createSession({ STORAGE, LOG, PARTITION });
    const REGISTRY = createRegistry();
    const DEBUGGER = createDebugger({ LOG });
    const AGENT = createAgent({ CONFIG, DEBUGGER, LOG });
    const SITE_PERMISSION = createSitePermission({ IDENTITY, SESSION, REGISTRY });
    const CERTIFICATE = createCertificate({ LOG, SESSION, REGISTRY });
    const SCRIPT = createScript({ LOG, DEBUGGER, SESSION, SITE_PERMISSION });
    const KEYMAP = createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE });
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
    const OPEN = createOpen({ LOG, IDENTITY, CORE });
    const NOTIFICATION = createNotification({ LOG, IDENTITY, clicked: () => host.notificationClicked() });
    const CLIPBOARD = createClipboard({ IDENTITY });
    const COMMAND = createCommand({ LOG, IDENTITY, CORE });
    const MAIN_PROCESS = createMainProcess({ STORAGE, WINDOW, LOG, IDENTITY, RUNNER, FOLDER });
    const MOD_FOLDER = createModFolder({ IDENTITY, CATALOG, MODS });
    const RUNTIME = createRuntime({ CONFIG, HOME, LOG, IDENTITY, restart: () => host.restart() });
    const PAGE = createPage({ IDENTITY, PARTITION, SANDBOX, RUNNER, LOG });
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
            nameOf: (webContents) => IDENTITY.modOf(webContents)?.id || IDENTITY.pageNameOf(webContents) || 'page',
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
            facts: (mod) => ({
                mainProcess: { running: MAIN_PROCESS.started(mod.id), failure: MAIN_PROCESS.failure(mod.id) },
            }),
            onFactsChange: MAIN_PROCESS.onChange,
            // Once what ran in its place has ended, modules and all.
            installed: async (id) => {
                await MAIN_PROCESS.whenEnded(id);
                MAIN_PROCESS.reinstalled(id);
                return { restart: MAIN_PROCESS.restartPending().some((pending) => pending.id === id) };
            },
            removed: MAIN_PROCESS.unload,
            clearSessions: SESSION.clearSessions,
        });
        // A mod's page shows the web in <webview>.
        RUNNER.start({ preparePage, webPreferences: { webviewTag: true } });
    }

    // A mod's page shows the web, hears the key map, and offers what it opens to the scheme's handlers: a window it
    // asks for, and a link that leaves its origin, which deck holds it to.
    function preparePage(webContents, mod) {
        WEB.prepareEmbedder(webContents);
        KEYMAP.listen(webContents, { page: WEB.pageFor(webContents) });
        const pressed = () => ({ userInitiated: IDENTITY.consumeUserActivation(webContents) });
        const unopened = (url) => (error) => LOG.warn(`${mod.id}: ${url} did not open`, error);
        webContents.setWindowOpenHandler((details) => {
            OPEN.open(details.url, { ...WEB.windowOptions(details), ...pressed() }).catch(unopened(details.url));
            return { action: 'deny' };
        });
        const origin = ORIGIN.originOf(mod.id);
        LOG.guard(webContents, 'will-frame-navigate', (details) => {
            if (details.isMainFrame && !details.url.startsWith(origin + '/'))
                OPEN.open(details.url, pressed()).catch(unopened(details.url));
        });
    }
}

export { SCHEME, connect };
