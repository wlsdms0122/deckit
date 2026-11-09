import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as REQUEST from '../request/index.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// MARK: - Initializer
// MARK: - Public
// The request for what is declared to `interface`, an interface the mod owns now, `[{ mod: { name }, credential: { mod,
// permissions }, entry }]`, `credential` the declaring mod's, frozen as a connection's is, refused with kind
// `NOT_OWNER` once it does not.
const contributions = REQUEST.requestOf(
    'exports.contributions',
    { signature: [['interface', 'string']] },
    async (name) => {
        const declared = await PROTOCOL.contributions.invoke({ interface: name });
        return declared.map(({ mod, credential, entry }) => ({
            mod: Object.freeze({ name: mod.name }),
            credential: Object.freeze({ mod: credential.mod, permissions: Object.freeze([...credential.permissions]) }),
            entry,
        }));
    }
);

// MARK: - Private
export { contributions };
