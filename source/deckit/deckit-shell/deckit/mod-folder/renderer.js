import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// A folder the person picks to install, as it would install, or null when they did not pick one. With `multiple`, the
// folders they pick, each as it would install or, refused, `{ from, problem }`, none when they picked none.
function pick({ multiple = false } = {}) {
    return PROTOCOL.pick.invoke({ multiple: !!multiple });
}

// The mod's folder, shown in Finder.
function reveal(id) {
    return PROTOCOL.reveal.invoke({ id: String(id) });
}

// MARK: - Private

export { pick, reveal };
