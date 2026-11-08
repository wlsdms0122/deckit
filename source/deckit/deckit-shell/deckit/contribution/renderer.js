import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// What is declared to `name`, an interface the mod owns now, `[{ mod: { id, name }, credential: { mod, permissions },
// entry }]`, `credential` the declaring mod's, frozen as a connection's is, rejected with kind `NOT_OWNER` once it
// does not.
async function contributions(name) {
    const declared = await PROTOCOL.contributions.invoke({ interface: String(name) });
    return declared.map(({ mod, credential, entry }) => ({
        mod,
        credential: Object.freeze({ mod: credential.mod, permissions: Object.freeze([...credential.permissions]) }),
        entry,
    }));
}

// MARK: - Private
export { contributions };
