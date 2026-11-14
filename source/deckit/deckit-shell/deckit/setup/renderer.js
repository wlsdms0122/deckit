import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../../../deckit-sdk/deckit/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// What this page is: { page }, the name a page that runs no mod was made by, or for a mod's { layers }, the layers
// stacked over deckit on it, each { name, setup }.
function setup() {
    return PROTOCOL.setup.invoke();
}

// MARK: - Private

export { setup };
