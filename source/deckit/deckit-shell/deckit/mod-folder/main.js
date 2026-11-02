import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../../deck/mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `dialogs` and `open` are the environment's.
export function createModFolder({ IDENTITY, CATALOG, MODS, dialogs: DIALOGS, open: SYSTEM }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.pick.handle(({ multiple }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return multiple ? pickMany() : pick();
        });
        PROTOCOL.reveal.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            const mod = CATALOG.found().find((candidate) => candidate.id === id);
            if (!mod) throw new Error('no mod ' + id);
            SYSTEM.reveal(mod.folder);
        });
    }

    // MARK: - Private
    // Picking and installing are two calls because the person is asked in between. A refused folder is refused
    // before they are asked about it.
    async function pick() {
        const [folder] = await DIALOGS.chooseFolders({
            title: 'Choose a mod folder',
            buttonLabel: 'Choose',
            message: 'Pick the folder that has manifest.toml in it',
        });
        return folder ? MODS.planInstall(folder) : null;
    }

    // Each folder refused on its own, so one refused leaves the others to install.
    async function pickMany() {
        const folders = await DIALOGS.chooseFolders({
            title: 'Choose mod folders',
            buttonLabel: 'Choose',
            message: 'Pick the folders that have manifest.toml in them',
            multiple: true,
        });
        return Promise.all(
            folders.map((from) =>
                MODS.planInstall(from).catch((error) => ({ from, problem: String(error?.message || error) }))
            )
        );
    }

    return { start };
}
