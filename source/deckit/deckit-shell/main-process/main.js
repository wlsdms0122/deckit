import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../deck/mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's main process modules, which the environment runs (`mainProcess`): a mod with system.main-process starts
// and calls its own, they start anew with each run and end with it, and what they emit goes to the mod's page.
export function createMainProcess({ IDENTITY, RUNNER, HOME, mainProcess: MODULES }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => MODULES.prepare(modOf(mod)));
        RUNNER.observe('didTerminate', ({ mod }) => MODULES.end(modOf(mod)));
        MODULES.onEvent((modId, path, name, args) => {
            const page = IDENTITY.pageOf(modId);
            if (page) PROTOCOL.event.send(page, { path, name, args });
        });
        PROTOCOL.start.handle(({ path }, sender) =>
            MODULES.start(modOf(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS)), path)
        );
        PROTOCOL.call.handle(({ path, method, args }, sender) =>
            MODULES.call(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS).id, path, method, args)
        );
        PROTOCOL.restartPending.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return MODULES.restartPending();
        });
    }

    // A mod taken away: its modules end with its run if it has not ended yet.
    function unload(modId) {
        const run = RUNNER.runOf(modId);
        MODULES.unload(modId, { running: !!run && run.state !== 'notRunning' });
    }

    // MARK: - Private
    // A mod as the environment runs its modules: its folder, its data folder, and the page it runs in now.
    function modOf(mod) {
        return Object.freeze({
            id: mod.id,
            folder: mod.folder,
            data: HOME.dataOf(mod.id),
            pageOf: () => IDENTITY.pageOf(mod.id),
        });
    }

    return {
        start,
        unload,
        onChange: MODULES.onChange,
        whenEnded: MODULES.whenEnded,
        started: MODULES.started,
        failure: MODULES.failure,
        restartPending: MODULES.restartPending,
        reinstalled: MODULES.reinstalled,
    };
}
