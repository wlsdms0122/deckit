import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';
import * as BUILD from '../build/index.js';
import * as MOD_PERMISSION from '../deck/mod/permission.js';

const PROTOCOL = IPC.bindAll(DECLARED);

// `restart` is the app's: the process is its own.
export function createRuntime({ CONFIG, HOME, LOG, IDENTITY, restart }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        const { app } = require('electron');
        PROTOCOL.about.handle((_payload, sender) => {
            IDENTITY.modFrom(sender);
            return {
                version: BUILD.VERSION,
                source: BUILD.SOURCE,
                name: CONFIG.name,
                home: require('os').homedir(),
                app: `${app.getName()} ${app.getVersion()}`,
                electron: process.versions.electron,
                chrome: process.versions.chrome,
                mods: HOME.mods,
                data: HOME.data,
                log: LOG.file(),
            };
        });
        PROTOCOL.restart.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            restart();
            return true;
        });
    }

    // MARK: - Private

    return { start };
}
