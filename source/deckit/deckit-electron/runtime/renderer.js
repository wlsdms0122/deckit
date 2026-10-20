import * as CHANNEL from '../../deckit-shell/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
function about() {
    return PROTOCOL.about.invoke();
}

function restart() {
    return PROTOCOL.restart.invoke();
}

// MARK: - Private

export { about, restart };
