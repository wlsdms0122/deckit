import * as MAIN_PROCESS_PERMISSION from './deckit/main-process/model/permission.js';
import * as WEB_PERMISSION from './deckit/web/model/permission.js';
import * as CLIPBOARD_PERMISSION from './deckit/clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from './deckit/notification/model/permission.js';
import * as KEYMAP_PERMISSION from './deckit/keymap/model/permission.js';
import * as OPEN_PERMISSION from './deckit/open/model/permission.js';
import * as COMMAND_PERMISSION from './deckit/command/model/permission.js';
import * as MOD_PERMISSION from './deck/mod/permission.js';
import * as STYLE_PERMISSION from './shell/style/model/permission.js';
import * as FONTS_PERMISSION from './shell/fonts/model/permission.js';
import * as WINDOW_PERMISSION from './shell/window/model/permission.js';
import * as CONFIGURATION_PERMISSION from './deckit/configuration/model/permission.js';
import * as ENVIRONMENT from './environment/index.js';
import * as IPC from './deck/ipc/main.js';
import { createHome } from './deck/home/index.js';
import { createStorage } from './deck/storage/index.js';
import * as BUILD from './deckit/build/index.js';
import { createLog } from './deck/log/main.js';
import { createPermission } from './deck/mod/permission.js';
import { createCatalog } from './deck/catalog/index.js';
import { createIdentity } from './deck/identity/index.js';
import { createRunner } from './deck/runner/main.js';
import { createRecord } from './deck/record/main.js';
import { createExport } from './deck/export/main.js';
import { createExtension } from './deck/extension/main.js';
import { createEvent } from './deck/event/main.js';
import { createMods } from './deck/mods/main.js';
import { createCore } from './deck/core/main.js';
import { createWeb } from './deckit/web/main.js';
import { createKeymap } from './deckit/keymap/main.js';
import { createOpen } from './deckit/open/main.js';
import { createNotification } from './deckit/notification/main.js';
import { createClipboard } from './deckit/clipboard/main.js';
import { createCommand } from './deckit/command/main.js';
import { createProvider } from './deckit/provider/main.js';
import { createConfiguration } from './deckit/configuration/main.js';
import { createMainProcess } from './deckit/main-process/main.js';
import { createModFolder } from './deckit/mod-folder/main.js';
import { createRuntime } from './deckit/runtime/main.js';
import { createPage, createSetup } from './shell/page/main.js';
import { createApi } from './api/index.js';
import { createRegion } from './shell/region/main.js';
import { createPanel } from './shell/panel/main.js';
import { createStyle } from './shell/style/main.js';
import { createTheme } from './shell/theme/main.js';
import { createFonts } from './shell/fonts/main.js';
import { createWindow } from './shell/window/main.js';

// MARK: - Property
// What the host app hands deckit, and what deckit makes of what it leaves out. `config`: `id` names everything deckit
// keeps, `name` is what a person reads, `agent` the names the host app adds to its user agent, taken out of a web
// page's, and `schemeHandlers`, by scheme, the mods asked first to open an address. `folders`: `home` is deckit's
// folder, ~/.config/<id> when none is given, `ship` the mod folders the host app ships, installed at every start, and
// `sources` folders of mods read in place, ahead of installed ones.
const CONFIG = { id: 'deckit', name: 'Deckit', agent: [], schemeHandlers: {} };
const FOLDERS = { home: null, ship: [], sources: [] };
// What the host app answers deckit: the process and its windows are its own. And what it answers the UI: where it is
// shown.
const CONNECT_ANSWERS = ['notificationClicked', 'restart'];
const ATTACH_ANSWERS = ['start', 'showsPanel', 'show', 'dismiss', 'panelTitled', 'showWindow', 'hideWindow'];
// Every permission the mod contract names, in the order a person reads them: deck's, deckit's, and those of deckit's
// shell. Each layer on a host defines those it gives.
const DECK_PERMISSIONS = [MOD_PERMISSION];
const DECKIT_PERMISSIONS = [
    MAIN_PROCESS_PERMISSION,
    WEB_PERMISSION,
    CLIPBOARD_PERMISSION,
    NOTIFICATION_PERMISSION,
    KEYMAP_PERMISSION,
    OPEN_PERMISSION,
    COMMAND_PERMISSION,
    CONFIGURATION_PERMISSION,
];
const SHELL_PERMISSIONS = [WINDOW_PERMISSION, STYLE_PERMISSION, FONTS_PERMISSION];
const VOCABULARY = [...DECK_PERMISSIONS, ...DECKIT_PERMISSIONS, ...SHELL_PERMISSIONS].flatMap(
    (model) => model.PERMISSIONS
);
// Main's channels are the process's: deckit connects once, and the UI is attached once, to what connect answered.
let connected = null;
let attached = false;

// MARK: - Public
// How a host app starts deckit, once, before the app is ready: `environment` is what the environment deckit runs on
// gives it (environment: MAIN), `host` answers what of deckit is the app's, and `config` and `folders` are its
// configuration. Answers what the app and the UI on deckit reach of deckit (api/index.js).
function connect(environment, { host, config = {}, folders = {} } = {}) {
    if (connected) throw new Error('[deckit] connect is called once');
    const ENV = ENVIRONMENT.checked(environment, ENVIRONMENT.MAIN, 'the environment');
    const missing = CONNECT_ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    refuseUnknown('config', config, Object.keys(CONFIG));
    refuseUnknown('folders', folders, Object.keys(FOLDERS));
    connected = make({
        ENV,
        host,
        config: Object.freeze({ ...CONFIG, ...config }),
        folders: Object.freeze({ ...FOLDERS, ...folders }),
    });
    return connected;
}

// How a host app puts deckit's UI on deckit, once, before it is ready: `deckit` is what connect answered, and `host`
// answers where the UI is shown. The UI starts with deckit, before any mod launches.
function attach(deckit, { host } = {}) {
    if (attached) throw new Error('[deckit] attach is called once');
    if (!connected) throw new Error('[deckit] attach comes after connect');
    if (deckit !== connected) throw new Error('[deckit] attach takes what connect answered');
    const missing = ATTACH_ANSWERS.filter((name) => typeof host?.[name] !== 'function');
    if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
    attached = true;
    deckit.attach();
    for (const model of SHELL_PERMISSIONS)
        for (const permission of model.PERMISSIONS) deckit.permissions.define(permission);
    const REGION = createRegion({ deckit });
    const WINDOW = createWindow({
        deckit,
        showWindow: (control) => host.showWindow(control),
        hideWindow: (control) => host.hideWindow(control),
    });
    const PANEL = createPanel({ REGION, deckit, host });
    const STYLE = createStyle({ deckit });
    const THEME = createTheme({ deckit });
    const FONTS = createFonts({ deckit });
    deckit.onStart(() => {
        THEME.start({ draws: (sender) => !!deckit.mods.modOf(sender) || !!deckit.pages.nameOf(sender) });
        FONTS.start({ onChange: THEME.setFonts });
        STYLE.start();
        REGION.start();
        PANEL.start();
        WINDOW.start();
        // A page is in front in the panel, or in a window of its own on screen.
        deckit.keymap.delegate({
            isActive: (page) => PANEL.isActive(page) || WINDOW.isActive(page),
            monitor: PANEL.monitor,
        });
        host.start({ setTheme: THEME.set, panel: PANEL.control });
    });
}

// MARK: - Private
function refuseUnknown(what, given, known) {
    if (typeof given !== 'object' || !given) throw new Error(`[deckit] ${what} is not an object`);
    const unknown = Object.keys(given).filter((key) => !known.includes(key));
    if (unknown.length) throw new Error(`[deckit] ${what} sets ${unknown.join(', ')}, which deckit does not read`);
}

// Deckit in main, made of deck's parts and deckit's, each handed what it uses of the environment.
function make({ ENV, host, config: CONFIG, folders: FOLDERS }) {
    ENV.configure({ id: CONFIG.id, agent: CONFIG.agent });
    const HOME = createHome({ CONFIG, FOLDERS, user: ENV.folders.user });
    const LOG = createLog({ log: ENV.log, reports: ENV.reports, about: ENV.about, folder: HOME.logs, name: CONFIG.id });
    // The channels are carried before anything crosses.
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    const CORE = createCore({ CONFIG, FOLDERS, LOG, core: ENV.core, home: HOME.folder });
    const STORAGE = createStorage({ CORE, LOG });
    const PERMISSION = createPermission({ vocabulary: VOCABULARY });
    const CATALOG = createCatalog({ CORE, LOG, files: ENV.files });
    const IDENTITY = createIdentity({ pages: ENV.pages });
    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: ENV.pages, app: ENV.app });
    const RECORD = createRecord({ CORE, IDENTITY });
    const CONFIGURATION = createConfiguration({ CORE, LOG, IDENTITY, RUNNER });
    const EXPORT = createExport({ CORE, IDENTITY, RUNNER });
    const EXTENSION = createExtension({ CORE, IDENTITY, RUNNER });
    const EVENT = createEvent({ CORE, LOG, IDENTITY });
    const MODS = createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, EXTENSION, pages: ENV.pages });
    const COMMAND = createCommand({ LOG, IDENTITY, RUNNER, CORE });
    const PROVIDER = createProvider({ CORE, IDENTITY });
    const PAGE = createPage({ IDENTITY, LOG, pages: ENV.pages });
    const KEYMAP = createKeymap({
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        CORE,
        pages: ENV.pages,
        keys: ENV.keys,
    });
    const WEB = createWeb({ LOG, IDENTITY, KEYMAP, STORAGE, web: ENV.web, pages: ENV.pages, open: ENV.open });
    const OPEN = createOpen({ LOG, IDENTITY, CORE, open: ENV.open });
    const NOTIFICATION = createNotification({
        LOG,
        IDENTITY,
        clicked: () => host.notificationClicked(),
        notifications: ENV.notifications,
    });
    const CLIPBOARD = createClipboard({ IDENTITY, clipboard: ENV.clipboard });
    const MAIN_PROCESS = createMainProcess({ IDENTITY, RUNNER, mainProcess: ENV.mainProcess });
    const MOD_FOLDER = createModFolder({ IDENTITY, CATALOG, MODS, dialogs: ENV.dialogs, open: ENV.open });
    const RUNTIME = createRuntime({
        CONFIG,
        CORE,
        LOG,
        IDENTITY,
        restart: () => host.restart(),
        about: ENV.about,
        user: ENV.folders.user,
    });
    const SETUP = createSetup({ IDENTITY, web: ENV.web });
    const API = createApi({
        CONFIG,
        CORE,
        STORAGE,
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        PERMISSION,
        WEB,
        KEYMAP,
        COMMAND,
        PROVIDER,
        MAIN_PROCESS,
        PAGE,
        SETUP,
        stage: ENV.stage,
    });
    const starting = []; // what starts with deckit, before any mod launches: the UI on it
    let started = false;

    // What deck and deckit give, on every host.
    for (const model of [...DECK_PERMISSIONS, ...DECKIT_PERMISSIONS])
        for (const permission of model.PERMISSIONS) PERMISSION.define(permission);
    const answer = API.make({ onStart, restart: () => host.restart() });
    ENV.app.whenReady().then(start);
    return answer;

    // `listener` is told once, as deckit starts once the app is ready, before any mod launches. It is handed over
    // before then.
    function onStart(listener) {
        if (started) throw new Error('[deckit] what starts with deckit is handed over before the app is ready');
        starting.push(listener);
    }

    // The log starts first, then the core, which is handed the permissions the layers defined and hands over the
    // state it keeps, and installs what the host app ships and reads the mods, before anything reads the mods or the
    // state. Deck's pages are served before any loads. What follows the mods' runs starts before the runner launches
    // any.
    async function start() {
        LOG.start({
            nameOf: (page) => IDENTITY.modOf(page)?.id || IDENTITY.pageNameOf(page) || 'page',
        });
        LOG.info(`deckit ${BUILD.VERSION} (sources ${BUILD.SOURCE})`);
        CORE.start(PERMISSION.all());
        await STORAGE.load();
        await CATALOG.load();
        ENV.pages.serve((modId) => CATALOG.mods().find((mod) => mod.id === modId)?.folder || null);
        WEB.start();
        KEYMAP.start();
        OPEN.start();
        NOTIFICATION.start();
        CLIPBOARD.start();
        COMMAND.start();
        PROVIDER.start();
        MAIN_PROCESS.start();
        MOD_FOLDER.start();
        RUNTIME.start();
        SETUP.start();
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
        CONFIGURATION.start();
        EXPORT.start();
        EXTENSION.start();
        EVENT.start();
        MODS.start({
            facts: (mod) => ({ mainProcess: MAIN_PROCESS.stateOf(mod.id) }),
            onFactsChange: MAIN_PROCESS.onChange,
            installed: MAIN_PROCESS.installed,
            removed: MAIN_PROCESS.removed,
            clearSessions: WEB.clearSessions,
        });
        RUNNER.start({ preparePage });
    }

    // A mod's page shows the web, hears the key map, and offers what it opens to the scheme's handlers: a window it
    // asks for, and a link that leaves its origin, which deck holds it to.
    function preparePage(page) {
        WEB.prepare(page);
        KEYMAP.listen(page, { page: WEB.pageFor(page) });
        ENV.pages.watch(page, {
            opens: (url, options) => OPEN.openFrom(page, url, options),
            leaves: (url) => OPEN.openFrom(page, url),
        });
    }
}

export { connect, attach };
