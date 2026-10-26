import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// The provider of `id`, `{ id, name, host }`, or null.
function provider(id) {
    return PROTOCOL.provider.invoke({ id: String(id) });
}

// MARK: - Private
export { provider };
