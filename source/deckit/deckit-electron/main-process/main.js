import * as CHANNEL from '../../deckit-sdk/deckit/channel/index.js';
import * as MOD_PERMISSION from '../../deckit-sdk/deckit/permission/index.js';
import * as REQUEST from '../../deckit-sdk/deckit/request/index.js';
import * as DECLARED from './protocol.js';
import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as MAIN_PROCESS_LAYER from './model/layer.js';

// How a host app puts a mod's main process modules on deckit, once, before it is ready: `deckit` is what connect
// answered, and `environment` what environment() answered, whose `mainProcess` runs the modules (loader.js). A mod
// with system.main-process starts and calls its own, they start anew with each run and end with it, and what they emit
// goes to the mod's page. A mod with deckit.mods reads which mods only a restart of the app finishes and how each
// mod's modules are, and is told when that may have changed. The app quits once the modules of the runs that ended
// have ended too. Its layer is stacked on each mod's page, and it starts with deckit, before any mod launches.
export function attach(deckit, environment) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const LOADER = environment.mainProcess;
    const APP = environment.app;
    const FILES = environment.files;
    const endings = new Set(); // the ends of modules still to come, each settled in its limit
    const watching = new Set(); // the pages told when what `restartPending` or `statusOf` answer may have changed

    // MARK: - Initializer
    for (const permission of MAIN_PROCESS_PERMISSION.PERMISSIONS) deckit.permissions.define(permission);
    deckit.stack(MAIN_PROCESS_LAYER.LAYER);
    deckit.onStart(start);

    // MARK: - Public
    // MARK: - Private
    function start() {
        deckit.mods.observe('willLaunch', (run) => LOADER.launching(modOf(run)));
        deckit.mods.onInstalled((modId) => LOADER.installed(modId));
        deckit.mods.onRemoved(removed);
        for (const name of ['didFailToLaunch', 'didTerminate'])
            deckit.mods.observe(name, (run) => {
                const ending = LOADER.ended(modOf(run), { within: deckit.mods.timeout().end }).catch(() => {});
                endings.add(ending);
                ending.then(() => endings.delete(ending));
            });
        APP.onQuit(() => {
            if (!endings.size) return false;
            Promise.all([...endings]).then(() => APP.quit());
            return true;
        });
        PROTOCOL.start.handle(({ path }, sender) => {
            const mod = modOf(deckit.mods.runOf(deckit.mods.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS)));
            return LOADER.start(mod, path, (relative) => handedTo(mod, relative));
        });
        PROTOCOL.call.handle(({ path, method, args }, sender) =>
            call(deckit.mods.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), path, method, args)
        );
        PROTOCOL.restartPending.handle((_payload, sender) => {
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            return LOADER.restartPending();
        });
        PROTOCOL.statusOf.handle(({ id }, sender) => {
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            return LOADER.statusOf(id);
        });
        PROTOCOL.watch.on((_payload, sender) => {
            deckit.mods.modFrom(sender, MOD_PERMISSION.MODS);
            if (watching.has(sender)) return;
            watching.add(sender);
            deckit.pages.whenEnds(sender, () => watching.delete(sender));
        });
        LOADER.onChange(() => {
            for (const page of watching) PROTOCOL.changed.send(page);
        });
    }

    // A mod taken away: its modules end with its run if it has not ended yet.
    function removed(modId) {
        const run = deckit.mods.runOf(modId);
        LOADER.removed(modId, { running: !!run && run.state !== 'notRunning' });
    }

    // A mod as the loader runs its modules, from a run of it: its folder, its data folder, and the page it runs in now.
    function modOf(run) {
        const id = run.mod.id;
        return Object.freeze({ id, folder: run.folder, data: run.data, pageOf: () => pageOf(id) });
    }

    // The page the mod runs in now, or null.
    function pageOf(modId) {
        return deckit.mods.runs().find(({ run }) => run.mod.id === modId)?.page ?? null;
    }

    // What a module is handed: the mod's id and data folder, `emit(name, ...args)`, which the mod's page hears from
    // the module at `path`, and `files`, with `refuse(kind, message)`, a refusal whose `kind` reaches the page.
    function handedTo(mod, path) {
        return Object.freeze({
            id: mod.id,
            data: mod.data,
            emit(name, ...args) {
                const page = pageOf(mod.id);
                if (page) PROTOCOL.event.send(page, { path, name: String(name), args });
            },
            files: Object.freeze({
                name: FILES.name,
                fresh: FILES.fresh,
                rename: FILES.rename,
                move: FILES.move,
                trash: FILES.trash,
                refuse: (kind, message) => Object.assign(new Error(message), { kind }),
            }),
        });
    }

    // What a method answers crosses to the mod's page, so it is what can be copied. A module not started in this run
    // is refused NOT_STARTED.
    async function call(modId, path, method, args) {
        const answer = await LOADER.call(modId, path, method, args).catch((error) => {
            throw error.kind === 'NOT_STARTED'
                ? REQUEST.refusal('call', 'NOT_STARTED', `${path} is not started; mainProcess.start() starts it`)
                : error;
        });
        try {
            structuredClone(answer);
        } catch (error) {
            throw new Error(`${path} ${method.join('.')} answered what cannot be copied: ${error.message}`);
        }
        return answer;
    }
}
