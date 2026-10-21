import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../deck/mod/permission.js';
import * as LIMIT from '../deck/runner/model/limit.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's main process modules, which the environment runs (`mainProcess`): a mod with system.main-process starts
// and calls its own, they start anew with each run and end with it, and what they emit goes to the mod's page.
export function createMainProcess({ IDENTITY, RUNNER, mainProcess: MODULES }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => MODULES.launching(modOf(mod)));
        RUNNER.observe('didTerminate', ({ mod }) => MODULES.ended(modOf(mod), { within: LIMIT.END_LIMIT_MS }));
        MODULES.onEvent((modId, path, name, args) => {
            const page = IDENTITY.pageOf(modId);
            if (page) PROTOCOL.event.send(page, { path, name, args });
        });
        PROTOCOL.start.handle(({ path }, sender) =>
            MODULES.start(modOf(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS)), path)
        );
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

    // What a method answers crosses to the mod's page, so it is what can be copied.
    async function call(mod, path, method, args) {
        const answer = await MODULES.call(mod.id, path, method, args);
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
