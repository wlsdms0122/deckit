import * as BUILD from '../build/index.js';

export function createRuntime({ PROTOCOL, MODS_PERMISSION, CONFIG, HOME, LOG, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // `restart` is the app's: the process is its own.
    function start({ restart }) {
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
            IDENTITY.modFrom(sender, MODS_PERMISSION);
            restart();
            return true;
        });
    }

    // MARK: - Private

    return { start };
}
