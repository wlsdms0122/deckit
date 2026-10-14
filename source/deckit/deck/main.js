import * as PROTOCOL from './protocol.js';
import * as MOD_PERMISSION from './mod/permission.js';
import * as LIFECYCLE from './mod/lifecycle.js';
import { createHome } from './storage/home.js';
import { createStorage } from './storage/index.js';
import { createLog } from './log/main.js';
import { createPermission } from './mod/permission.js';
import { createManifest } from './mod/manifest.js';
import { createFolder } from './mod/folder.js';
import { createInstall } from './install/index.js';
import { createRemove } from './install/remove.js';
import { createCatalog } from './catalog/index.js';
import { createIdentity } from './identity/index.js';
import { createSandbox } from './sandbox/index.js';
import { createRunner } from './runner/main.js';
import { createRecord } from './record/main.js';
import { createSetting } from './setting/main.js';
import { createExport } from './export/main.js';
import { createExtension } from './extension/main.js';
import { createEvent } from './event/main.js';

// Deck in main, made of its parts, each handed what it uses. `id` names everything deck keeps; `home` is its folder,
// ~/.config/<id> when none is given; `ship` the mod folders the host app ships, installed at every start; `sources`
// folders of mods read in place, ahead of installed ones. Answers what the layers on deck reach of it.
export function createDeck({ id = 'deckit', home = null, ship = [], sources = [] } = {}) {
    const CONFIG = Object.freeze({ id, home, ship, sources });
    const HOME = createHome({ CONFIG });
    const STORAGE = createStorage({ HOME });
    const LOG = createLog({ CONFIG, HOME });
    const PERMISSION = createPermission();
    for (const permission of MOD_PERMISSION.PERMISSIONS) PERMISSION.define(permission);
    const MANIFEST = createManifest({ MOD_PERMISSION: PERMISSION });
    const FOLDER = createFolder({ MANIFEST });
    const INSTALL = createInstall({ CONFIG, HOME, FOLDER });
    const REMOVE = createRemove({ STORAGE, MANIFEST, INSTALL });
    const CATALOG = createCatalog({ CONFIG, HOME, STORAGE, LOG, FOLDER, INSTALL });
    const IDENTITY = createIdentity();
    const SANDBOX = createSandbox({ CONFIG, CATALOG, FOLDER });
    const RUNNER = createRunner({ STORAGE, LOG, IDENTITY, CATALOG, SANDBOX, MANIFEST });
    const RECORD = createRecord({ STORAGE, IDENTITY });
    const SETTING = createSetting({ STORAGE, IDENTITY, CATALOG, RUNNER });
    const EXPORT = createExport({ IDENTITY, RUNNER });
    const EXTENSION = createExtension({ IDENTITY, RUNNER, EXPORT });
    const EVENT = createEvent({ IDENTITY, RUNNER });

    // MARK: - Property
    let layer = null;
    const watching = new Set(); // the pages told when what `mods` answers may have changed

    // MARK: - Initializer
    // MARK: - Public
    // Before any page of deck's loads, once the app is ready: `preload` is the file every page loads with. The log
    // starts then, and what the host app ships is installed, before anything reads the mods.
    function prepare({ preload }) {
        LOG.start({
            nameOf: (webContents) => IDENTITY.modOf(webContents)?.id || IDENTITY.pageNameOf(webContents) || 'page',
        });
        SANDBOX.start({ preload });
        if (!CONFIG.ship.length) return;
        for (const { id, outcome, problem } of INSTALL.installShipped())
            if (problem) LOG.warn(`${outcome} ${id}: ${problem}`);
            else LOG.info(`${outcome} ${id}`);
    }

    // What follows the mods' runs starts before the runner launches any.
    // What is on deck is told of a mod's page as it is made (`preparePage(webContents, mod)`), of a mod installed,
    // once what runs in its place has launched, and answers what it adds to what install answers
    // (`installed(id)`), and of one removed (`removed(id)`); it is asked what it knows of a mod (`describe(mod)`)
    // and to clear the sessions it made for a mod removed with its data (`clearSessions(id)`, a promise).
    function start({ preparePage, describe: facts, installed, removed, clearSessions }) {
        layer = { facts, installed, removed, clearSessions };
        clearUncleared();
        CATALOG.start();
        RECORD.start();
        SETTING.start();
        EXPORT.start();
        EXTENSION.start();
        EVENT.start();
        listen();
        RUNNER.start({ preparePage });
    }

    // MARK: - Private
    function listen() {
        PROTOCOL.mods.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return describe();
        });
        // What a mod installed may do is granted as it installs, so the person installs it: during their click or key.
        PROTOCOL.install.handle(({ from }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            if (!IDENTITY.consumeUserActivation(sender))
                throw Object.assign(new Error('a mod is installed during a click or a key of the person'), {
                    kind: 'REFUSED',
                });
            return install(from);
        });
        PROTOCOL.remove.handle(({ id, data }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return remove(id, data);
        });
        PROTOCOL.relaunch.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            RUNNER.relaunch(id);
        });
        PROTOCOL.count.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            // A mod id names a folder of deck's and nothing outside it.
            const problem = MANIFEST.idProblem(id);
            if (problem) throw Object.assign(new Error(problem), { kind: 'REFUSED' });
            return STORAGE.count(id);
        });
        PROTOCOL.watchMods.on((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            if (watching.has(sender)) return;
            watching.add(sender);
            IDENTITY.whenPageEnds(sender, () => watching.delete(sender));
        });
        const tell = () => {
            for (const page of watching) PROTOCOL.modsChanged.send(page);
        };
        CATALOG.onChange(tell);
        for (const name of LIFECYCLE.NOTIFICATIONS) RUNNER.observe(name, tell);
    }

    // What a mod with deckit.mods reads of every mod, loaded or not, and what each running one contributes.
    // `state`: its latest run's, null for one with none. `starting`: it is launching. `hides`: folders of the same
    // id that are not read.
    function describe() {
        const running = (id) => RUNNER.runOf(id)?.state === 'running';
        return {
            installed: CATALOG.found().map((mod) => {
                const run = RUNNER.runOf(mod.id);
                return {
                    ...MANIFEST.of(mod),
                    folder: mod.folder,
                    installed: mod.installed,
                    shipped: mod.shipped,
                    hides: mod.hides,
                    problem: mod.problem || run?.problem || null,
                    state: run?.state || null,
                    starting: run?.state === 'launching',
                    ...layer.facts(mod),
                    dependencies: mod.dependencies.map((dependency) => ({
                        ...dependency,
                        ok: dependency.ok && running(dependency.id),
                    })),
                };
            }),
            running: CATALOG.mods()
                .filter((mod) => running(mod.id))
                .map((mod) => {
                    const { summary, problem } = RUNNER.runOf(mod.id);
                    return {
                        id: mod.id,
                        name: mod.name,
                        ...summary,
                        extends: EXTENSION.pointsExtendedBy(mod.id),
                        problem,
                    };
                }),
        };
    }

    // What a folder would install, asked before the person is: its manifest, and whether it replaces an installed
    // mod. Throws for a folder install refuses, with why.
    function wouldInstall(from) {
        const manifest = INSTALL.wouldInstall(from, shadowed);
        return {
            ...MANIFEST.of(manifest),
            from,
            replaces: CATALOG.found().some((mod) => mod.id === manifest.id && mod.installed),
        };
    }

    // Any folder, since a mod may already run code in this process: restricting where it comes from guards
    // nothing.
    async function install(from) {
        const manifest = INSTALL.install(from, shadowed);
        CATALOG.refresh({ installed: manifest.id });
        await RUNNER.whenClosed(manifest.id);
        return { ...layer.installed(manifest.id), ...MANIFEST.of(manifest) };
    }

    // A source folder of the same id would hide the installed copy.
    function shadowed(manifest) {
        const source = CATALOG.found().find((mod) => mod.id === manifest.id && !mod.installed);
        return source ? `${manifest.id} is read from ${source.folder}, which would hide the installed copy` : '';
    }

    // Its run has ended, stop() and all, and its page closed, before what it stored is taken, so nothing writes it
    // back.
    async function remove(id, data) {
        const mod = CATALOG.found().find((candidate) => candidate.id === id);
        if (mod && !mod.installed)
            throw new Error(`${id} is read from ${mod.folder}, not installed, so it is removed there`);
        REMOVE.remove(id);
        layer.removed(id);
        CATALOG.refresh();
        await RUNNER.whenClosed(id);
        const removed = { data: data && REMOVE.eraseData(id) };
        if (removed.data) await clearSessions(id);
        return removed;
    }

    // A mod removed with its data, whose pages' storage and sessions were not cleared then: cleared here.
    function clearUncleared() {
        for (const id of REMOVE.uncleared()) {
            clearSessions(id).catch((error) => LOG.warn(`could not clear the web storage of ${id}`, error));
        }
    }

    // The record that it is to be cleared goes only once it is, so a failure is tried again at the next start.
    async function clearSessions(id) {
        await SANDBOX.clearSessions(id);
        await layer.clearSessions(id);
        REMOVE.cleared(id);
    }

    return {
        SCHEME: SANDBOX.SCHEME,
        prepare,
        start,
        wouldInstall,
        view: SANDBOX.view,
        log: LOG,
        home: HOME,
        storage: STORAGE,
        identity: IDENTITY,
        catalog: CATALOG,
        runner: RUNNER,
        manifest: MANIFEST,
        permission: PERMISSION,
        folder: FOLDER,
    };
}

// What the layers on deck read of it: the scheme its pages load from and their origins, a run's notifications, the
// permissions deck checks itself, and how a name of a mod's is scoped by it.
export { SCHEME, originOf, pageOriginOf, addressOf } from './sandbox/model/origin.js';
export { NOTIFICATIONS } from './mod/lifecycle.js';
export { MODS, MOD_SETTINGS } from './mod/permission.js';
export { scopedName } from './mod/model/scoped-name.js';
