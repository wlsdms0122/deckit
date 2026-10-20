import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// What this page is: { page }, the name of a page the shell made, or for a mod's { sessionPrefix }.
function setup() {
    return PROTOCOL.setup.invoke();
}

// MARK: - Private

export { setup };
