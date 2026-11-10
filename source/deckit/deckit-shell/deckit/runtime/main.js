import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from '../../../deckit-sdk/deckit/runtime/protocol.js';
import * as BUILD from '../build/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `restart` is the app's: the process is its own. `about` and `user` are the environment's: the host app, what runs
// it, and the person's home folder.
export function createRuntime({ CONFIG, CORE, LOG, restart, about: ABOUT, user }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.about.handle(() => {
            return {
                version: BUILD.VERSION,
                source: BUILD.SOURCE,
                name: CONFIG.name,
                home: user,
                app: `${ABOUT.app.name} ${ABOUT.app.version}`,
                engines: ABOUT.engines,
            };
        });
        // The system's own: where it installs mods, where it keeps their data, and the file it logs to.
        PROTOCOL.folders.handle(() => {
            return { mods: CORE.folders().mods, data: CORE.folders().data, log: LOG.file() };
        });
        PROTOCOL.restart.handle(() => {
            restart();
            return true;
        });
    }

    return { start };
}
