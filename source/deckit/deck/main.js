import * as MOD_PERMISSION from './mod/permission.js';
import { createHome } from './storage/home.js';
import { createStorage } from './storage/index.js';
import { createLog } from './log/main.js';
import { createCore } from './core/main.js';
import { createPermission } from './mod/permission.js';
import { createFolder } from './mod/folder.js';
import { createCatalog } from './catalog/index.js';
import { createIdentity } from './identity/index.js';
import { createSandbox } from './sandbox/index.js';
import { createRunner } from './runner/main.js';
import { createRecord } from './record/main.js';
import { createSetting } from './setting/main.js';
import { createExport } from './export/main.js';
import { createExtension } from './extension/main.js';
import { createEvent } from './event/main.js';
import { createRemove } from './mods/remove.js';
import { createMods } from './mods/main.js';

// Deck in main, made of its parts, each handed what it uses. `id` names everything deck keeps; `home` is its folder,
// ~/.config/<id> when none is given; `ship` the mod folders the host app ships, installed at every start; `sources`
// folders of mods read in place, ahead of installed ones; `core` the core's executable. Answers what the layers on deck
// reach of it.
export function createDeck({ id = 'deckit', home = null, ship = [], sources = [], core } = {}) {
    const CONFIG = Object.freeze({ id, home, ship, sources, core });
    const HOME = createHome({ CONFIG });
    const LOG = createLog({ CONFIG, HOME });
    const CORE = createCore({ CONFIG, HOME, LOG });
    const STORAGE = createStorage({ HOME, CORE, LOG });
    const PERMISSION = createPermission();
    for (const permission of MOD_PERMISSION.PERMISSIONS) PERMISSION.define(permission);
    const FOLDER = createFolder();
    const CATALOG = createCatalog({ CORE, LOG });
    const IDENTITY = createIdentity();
    const SANDBOX = createSandbox({ CONFIG, IDENTITY, CATALOG, FOLDER });
    const RUNNER = createRunner({ STORAGE, LOG, IDENTITY, CATALOG, SANDBOX, CORE });
    const RECORD = createRecord({ CORE, IDENTITY });
    const SETTING = createSetting({ STORAGE, IDENTITY, CATALOG, RUNNER });
    const EXPORT = createExport({ IDENTITY, RUNNER });
    const EXTENSION = createExtension({ IDENTITY, RUNNER, EXPORT });
    const EVENT = createEvent({ IDENTITY, RUNNER });
    const REMOVE = createRemove({ STORAGE });
    const MODS = createMods({ LOG, IDENTITY, REMOVE, CATALOG, RUNNER, SANDBOX, STORAGE, RECORD, EXTENSION });

    // MARK: - Initializer
    // MARK: - Public
    // Before any page of deck's loads, once the app is ready: `preload` is the file every page loads with. The log
    // starts then, then the core, which is handed the permissions the layers defined and hands over the state it keeps,
    // and installs what the host app ships and reads the mods, before anything reads the mods or the state.
    async function prepare({ preload }) {
        LOG.start({
            nameOf: (webContents) => IDENTITY.modOf(webContents)?.id || IDENTITY.pageNameOf(webContents) || 'page',
        });
        CORE.start({ permissions: PERMISSION.all() });
        await STORAGE.load();
        await CATALOG.load();
        SANDBOX.start({ preload });
    }

    // What follows the mods' runs starts before the runner launches any. What is on deck adds to a mod's page's
    // `webPreferences` and is told of the page as it is made (`preparePage(webContents, mod)`); the rest it is told
    // and asked is the mods' (mods/main.js).
    function start({ webPreferences, preparePage, describe: facts, onFactsChange, installed, removed, clearSessions }) {
        RECORD.start();
        SETTING.start();
        EXPORT.start();
        EXTENSION.start();
        EVENT.start();
        MODS.start({ facts, onFactsChange, installed, removed, clearSessions });
        RUNNER.start({ preparePage, webPreferences });
    }

    // What the layers on deck reach of it, and no more: who a page is, the mods and their runs, what a layer defines,
    // where a mod's files and deck's state are, and the log.
    return Object.freeze({
        SCHEME: SANDBOX.SCHEME,
        prepare,
        start,
        wouldInstall: MODS.wouldInstall,
        pages: Object.freeze({ make: SANDBOX.page }),
        identity: Object.freeze({
            modFrom: IDENTITY.modFrom,
            modOf: IDENTITY.modOf,
            pageOf: IDENTITY.pageOf,
            pageNameOf: IDENTITY.pageNameOf,
            whenPageEnds: IDENTITY.whenPageEnds,
            watchPresses: IDENTITY.watchPresses,
            consumeUserActivation: IDENTITY.consumeUserActivation,
            passUserActivation: IDENTITY.passUserActivation,
            isPressing: IDENTITY.isPressing,
            isPointing: IDENTITY.isPointing,
        }),
        catalog: Object.freeze({
            mods: CATALOG.mods,
            found: CATALOG.found,
            onChange: CATALOG.onChange,
            arrange: CATALOG.arrange,
        }),
        runner: Object.freeze({
            observe: RUNNER.observe,
            runs: RUNNER.runs,
            runOf: RUNNER.runOf,
            launchedOf: RUNNER.launchedOf,
            relaunchAll: RUNNER.relaunchAll,
        }),
        permission: Object.freeze({ define: PERMISSION.define }),
        folder: Object.freeze({ fileIn: FOLDER.fileIn }),
        storage: Object.freeze({ state: STORAGE.state, stateIn: STORAGE.stateIn, folderOf: STORAGE.folderOf }),
        home: Object.freeze({ data: HOME.data, mods: HOME.mods }),
        log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error, file: LOG.file, guard: LOG.guard }),
    });
}

// What the layers on deck read of it: the scheme its pages load from and their origins, a run's notifications, the
// permissions deck checks itself, and how a name of a mod's is scoped by it.
export { SCHEME } from './contract/index.js';
export { originOf, pageOriginOf, addressOf } from './sandbox/model/origin.js';
export { NOTIFICATIONS } from './mod/lifecycle.js';
export { MODS, MOD_SETTINGS } from './mod/permission.js';
export { scopedName } from './mod/model/scoped-name.js';
// A frozen copy all the way down, for a layer that hands out what deck holds.
export { deepFreeze } from './export/proxy.js';
