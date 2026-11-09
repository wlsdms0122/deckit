import * as CLIPBOARD_PERMISSION from '../../../deckit-sdk/deckit/clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../../../deckit-sdk/deckit/notification/model/permission.js';
import * as OPEN_PERMISSION from '../../../deckit-sdk/deckit/open/model/permission.js';
import * as ENVIRONMENT from '../environment/index.js';
import * as IPC from '../ipc/main.js';
import { createHome } from '../home/index.js';
import { createStorage } from '../storage/index.js';
import * as BUILD from '../build/index.js';
import { createLog } from '../log/main.js';
import { createPermission } from '../../../deckit-sdk/deckit/permission/index.js';
import { createManifestField } from '../manifest-field/index.js';
import { createCatalog } from '../catalog/index.js';
import { createIdentity } from '../identity/index.js';
import { createRunner } from '../runner/main.js';
import { createRecord } from '../record/main.js';
import { createRequest } from '../request/main.js';
import { createConnection } from '../connection/main.js';
import { createEvent } from '../event/main.js';
import { createMods } from '../mods/main.js';
import { createCore } from '../core/main.js';
import { createOpen } from '../open/main.js';
import { createNotification } from '../notification/main.js';
import { createClipboard } from '../clipboard/main.js';
import { createContribution } from '../contribution/main.js';
import { createRuntime } from '../runtime/main.js';
import { createSetup } from '../setup/main.js';
import { createApi } from '../api/index.js';
import { API } from '../contract/index.js';

// MARK: - Property
// What the host app hands deckit, and what deckit makes of what it leaves out. `config`: `id` names everything deckit
// keeps, `name` is what a person reads, and `api` the version of the mod contract deckit runs mods with, which the
// core judges.
// `folders`: `home` is deckit's folder, ~/.config/<id> when none is given, `ship` the mod folders the host app ships,
// installed at every start, each `{ folder, system }`, `system` whether the host app names it a system mod, and
// `sources` folders of mods read in place, ahead of installed ones.
const CONFIG = { id: 'deckit', name: 'Deckit', api: API };
const FOLDERS = { home: null, ship: [], sources: [] };
// What the host app answers deckit: the process and its windows are its own.
const CONNECT_ANSWERS = ['notificationClicked', 'restart'];
// The permissions deckit's passages define, in the order a person reads them.
const DECKIT_PERMISSIONS = [CLIPBOARD_PERMISSION, NOTIFICATION_PERMISSION, OPEN_PERMISSION];
// Main's channels are the process's: deckit connects once.
let connected = null;

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
    refuseShip(folders.ship ?? FOLDERS.ship);
    connected = make({
        ENV,
        host,
        config: Object.freeze({ ...CONFIG, ...config }),
        folders: Object.freeze({ ...FOLDERS, ...folders }),
    });
    return connected;
}

// What connect answered, or null before it is called.
function answered() {
    return connected;
}

// Throws for a key of `given`, what a host app hands as `what`, that is none of `known`.
function refuseUnknown(what, given, known) {
    if (typeof given !== 'object' || !given) throw new Error(`[deckit] ${what} is not an object`);
    const unknown = Object.keys(given).filter((key) => !known.includes(key));
    if (unknown.length) throw new Error(`[deckit] ${what} sets ${unknown.join(', ')}, which deckit does not read`);
}

// MARK: - Private
function refuseShip(ship) {
    const marked = (mod) => typeof mod?.folder === 'string' && typeof mod.system === 'boolean';
    if (!Array.isArray(ship) || !ship.every(marked))
        throw new Error('[deckit] folders.ship lists { folder, system } for each mod folder the host app ships');
}

// Deckit in main, made of its parts, each handed what it uses of the environment.
function make({ ENV, host, config: CONFIG, folders: FOLDERS }) {
    ENV.configure({ id: CONFIG.id });
    const HOME = createHome({ CONFIG, FOLDERS, user: ENV.folders.user });
    const LOG = createLog({ log: ENV.log, reports: ENV.reports, about: ENV.about, folder: HOME.logs, name: CONFIG.id });
    // The channels are carried before anything crosses.
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    const CORE = createCore({ FOLDERS, LOG, core: ENV.core, home: HOME.folder, api: CONFIG.api });
    const STORAGE = createStorage({ CORE, LOG });
    const PERMISSION = createPermission();
    const MANIFEST_FIELD = createManifestField();
    const CATALOG = createCatalog({ CORE, LOG, files: ENV.files });
    const IDENTITY = createIdentity({ pages: ENV.pages });
    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: ENV.pages, app: ENV.app });
    const RECORD = createRecord({ CORE, IDENTITY });
    const REQUEST = createRequest();
    const CONNECTION = createConnection({ CORE, LOG, IDENTITY, CATALOG, RUNNER, REQUEST });
    const EVENT = createEvent({ CORE, LOG, IDENTITY, RUNNER });
    const MODS = createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, REQUEST, pages: ENV.pages });
    const CONTRIBUTION = createContribution({ CORE, IDENTITY });
    const OPEN = createOpen({ IDENTITY, open: ENV.open });
    const NOTIFICATION = createNotification({
        LOG,
        IDENTITY,
        clicked: () => host.notificationClicked(),
        notifications: ENV.notifications,
    });
    const CLIPBOARD = createClipboard({ IDENTITY, clipboard: ENV.clipboard });
    const RUNTIME = createRuntime({
        CONFIG,
        CORE,
        LOG,
        IDENTITY,
        restart: () => host.restart(),
        about: ENV.about,
        user: ENV.folders.user,
    });
    const SETUP = createSetup({ IDENTITY });
    const API = createApi({
        CONFIG,
        CORE,
        STORAGE,
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        MODS,
        OPEN,
        REQUEST,
        PERMISSION,
        MANIFEST_FIELD,
        SETUP,
    });
    const starting = []; // what starts with deckit, before any mod launches: the UI on it
    let told = false; // what starts with deckit has been told

    // What deckit's passages give, on every host.
    for (const model of DECKIT_PERMISSIONS) for (const permission of model.PERMISSIONS) PERMISSION.define(permission);
    const startup = ENV.app.whenReady().then(start);
    startup.catch((error) => LOG.error('deckit did not start', error));
    return API.make({ onStart, whenStarted: () => startup, restart: () => host.restart() });

    // `listener` is told once, as deckit starts once the app is ready, before any mod launches. It is handed over
    // before then.
    function onStart(listener) {
        if (told) throw new Error('[deckit] what starts with deckit is handed over before the app is ready');
        starting.push(listener);
    }

    // The log starts first, then the core, which is handed the permissions the layers defined and the manifest fields
    // they named, and hands over the state it keeps, and installs what the host app ships and reads the mods, before
    // anything reads the mods or the state. Deckit's pages are served before any loads. What follows the mods' runs
    // starts before the runner launches any. Resolves once the background mods have launched, or failed to. A core
    // that refuses initialize is asked nothing more: what starts with deckit starts all the same, so it shows the core
    // is down, and then the start is refused with that refusal, and no mod runs.
    async function start() {
        LOG.start({
            nameOf: (page) => IDENTITY.modOf(page)?.id || IDENTITY.pageNameOf(page) || 'page',
        });
        LOG.info(`deckit ${BUILD.VERSION} (sources ${BUILD.SOURCE})`);
        const refusal = await CORE.start({ ...PERMISSION.all(), ...MANIFEST_FIELD.all() }).then(
            () => null,
            (error) => error
        );
        if (!refusal) {
            await STORAGE.load();
            await CATALOG.load();
        }
        ENV.pages.serve((modId) => CATALOG.mods().find((mod) => mod.id === modId)?.folder || null);
        OPEN.start();
        NOTIFICATION.start();
        CLIPBOARD.start();
        CONTRIBUTION.start();
        RUNTIME.start();
        SETUP.start();
        told = true;
        // What fails to start with deckit fails alone: the mods run whatever it did.
        for (const listener of starting) {
            try {
                listener();
            } catch (error) {
                LOG.error('what starts with deckit did not start', error);
            }
        }
        if (refusal) throw refusal;
        RECORD.start();
        CONNECTION.start();
        EVENT.start();
        MODS.start();
        await RUNNER.start();
    }
}

export { connect, answered, refuseUnknown };
