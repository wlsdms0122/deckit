import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// What is declared to `name`, an interface the mod owns now, `[{ mod: { id, name }, entry }]`, rejected with
// kind `NOT_OWNER` once it does not.
function contributions(name) {
    return PROTOCOL.contributions.invoke({ interface: String(name) });
}

// MARK: - Private
export { contributions };
