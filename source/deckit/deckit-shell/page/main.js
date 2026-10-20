import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What each page deckit makes is, answered to the page as it starts. `web` is what the environment gives of the web
// (environment: MAIN.web).
export function createSetup({ IDENTITY, web }) {
    // MARK: - Property
    let attached = false; // whether the shell's UI is on deckit, so each mod's page wears it

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            return { sessions: web.sessionsOf(IDENTITY.modOf(sender).id), attached };
        });
    }

    // The shell's UI is put on deckit (`attach`): each mod's page that starts from now on is given its part.
    function attach() {
        attached = true;
    }

    // MARK: - Private

    return { start, attach };
}
