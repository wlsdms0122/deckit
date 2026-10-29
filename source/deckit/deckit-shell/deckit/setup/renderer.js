import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// What this page is: { page }, the name a page that runs no mod was made by, or for a mod's { sessions, layers }, what
// its web sessions are named by and the names of the layers stacked over deckit on it.
function setup() {
    return PROTOCOL.setup.invoke();
}

// MARK: - Private

export { setup };
