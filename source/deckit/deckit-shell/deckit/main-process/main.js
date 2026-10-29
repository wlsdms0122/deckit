import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../../deck/mod/permission.js';
import * as LIMIT from '../../deck/runner/model/limit.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's main process modules, which the environment runs (`mainProcess`): a mod with system.main-process starts
// and calls its own, they start anew with each run and end with it, and what they emit goes to the mod's page. The
// app quits once the modules of the runs that ended have ended too. `files` is the environment's.
export function createMainProcess({ IDENTITY, RUNNER, mainProcess: MODULES, app: APP, files: FILES }) {
    // MARK: - Property
    const endings = new Set(); // the ends of modules still to come, each settled in its limit

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => MODULES.launching(modOf(mod)));
        RUNNER.observe('didTerminate', ({ mod }) => {
            const ending = MODULES.ended(modOf(mod), { within: LIMIT.END_LIMIT_MS }).catch(() => {});
            endings.add(ending);
            ending.then(() => endings.delete(ending));
        });
        APP.onQuit(() => {
            if (!endings.size) return false;
            Promise.all([...endings]).then(() => APP.quit());
            return true;
        });
        PROTOCOL.start.handle(({ path }, sender) => {
            const mod = modOf(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS));
            return MODULES.start(mod, path, (relative) => handedTo(mod, relative));
        });
        PROTOCOL.call.handle(({ path, method, args }, sender) =>
            call(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), path, method, args)
        );
        PROTOCOL.restartPending.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return MODULES.restartPending();
        });
    }

    // A mod taken away: its modules end with its run if it has not ended yet.
    function removed(modId) {
        const run = RUNNER.runOf(modId);
        MODULES.removed(modId, { running: !!run && run.state !== 'notRunning' });
    }

    // MARK: - Private
    // A mod as the environment runs its modules: its folder, its data folder, and the page it runs in now.
    function modOf(mod) {
        return Object.freeze({
            id: mod.id,
            folder: mod.folder,
            data: mod.data,
            pageOf: () => IDENTITY.pageOf(mod.id),
        });
    }

    // What a module is handed: the mod's id and data folder, `emit(name, ...args)`, which the mod's page hears from
    // the module at `path`, and `files`, with `refuse(kind, message)`, a refusal whose `kind` reaches the page.
    function handedTo(mod, path) {
        return Object.freeze({
            id: mod.id,
            data: mod.data,
            emit(name, ...args) {
                const page = IDENTITY.pageOf(mod.id);
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

    // What a method answers crosses to the mod's page, so it is what can be copied.
    async function call(mod, path, method, args) {
        const answer = await MODULES.call(mod.id, path, method, args).catch((error) => {
            throw error.kind === 'NOT_STARTED'
                ? new Error(`${path} is not started; deckit.mainProcess() starts it`)
                : error;
        });
        try {
            structuredClone(answer);
        } catch (error) {
            throw new Error(`${path} ${method.join('.')} answered what cannot be copied: ${error.message}`);
        }
        return answer;
    }

    return {
        start,
        removed,
        installed: MODULES.installed,
        stateOf: MODULES.stateOf,
        onChange: MODULES.onChange,
        restartPending: MODULES.restartPending,
    };
}
