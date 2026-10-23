import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as BUILD from '../build/index.js';
import * as MOD_PERMISSION from '../../deck/mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `restart` is the app's: the process is its own. `about` and `user` are the environment's: the host app, what runs
// it, and the person's home folder.
export function createRuntime({ CONFIG, CORE, LOG, IDENTITY, restart, about: ABOUT, user }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.about.handle((_payload, sender) => {
            IDENTITY.modFrom(sender);
            return {
                version: BUILD.VERSION,
                source: BUILD.SOURCE,
                name: CONFIG.name,
                home: user,
                app: `${ABOUT.app.name} ${ABOUT.app.version}`,
                ...enginesOf(ABOUT.engines),
                mods: CORE.folders().mods,
                data: CORE.folders().data,
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
    // Each engine's version under its key, as a mod reads them (`electron`, `chrome`).
    function enginesOf(engines) {
        return Object.fromEntries(engines.map(({ key, version }) => [key, version]));
    }

    return { start };
}
