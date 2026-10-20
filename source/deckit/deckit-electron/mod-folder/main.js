import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../deck/mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createModFolder({ IDENTITY, CATALOG, MODS }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.pick.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return pick();
        });
        PROTOCOL.reveal.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            const mod = CATALOG.found().find((candidate) => candidate.id === id);
            if (!mod) throw new Error('no mod ' + id);
            require('electron').shell.showItemInFolder(mod.folder);
        });
    }

    // MARK: - Private
    // Picking and installing are two calls because the person is asked in between. A refused folder is refused
    // before they are asked about it.
    async function pick() {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            title: 'Choose a mod folder',
            buttonLabel: 'Choose',
            properties: ['openDirectory'],
            message: 'Pick the folder that has manifest.toml in it',
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return MODS.wouldInstall(result.filePaths[0]);
    }

    return { start };
}
