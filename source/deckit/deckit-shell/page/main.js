import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What each page deckit makes is, answered to the page as it starts. `web` is what the environment gives of the web
// (environment: MAIN.web).
export function createSetup({ IDENTITY, web }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            return { sessions: web.sessionsOf(IDENTITY.modOf(sender).id) };
        });
    }

    // MARK: - Private

    return { start };
}
