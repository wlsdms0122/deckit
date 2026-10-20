import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// A folder the person picks to install, as it would install, or null when they did not pick one.
function pick() {
    return PROTOCOL.pick.invoke();
}

// The mod's folder, shown in Finder.
function reveal(id) {
    return PROTOCOL.reveal.invoke({ id: String(id) });
}

// MARK: - Private

export { pick, reveal };
