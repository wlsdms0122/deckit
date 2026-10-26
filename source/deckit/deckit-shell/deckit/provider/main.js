import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as COMMAND_PERMISSION from '../command/model/permission.js';
import * as KEYMAP_PERMISSION from '../keymap/model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// What a mod holds to read the providers it is told of: the commands or the keys they declare.
const READS = [COMMAND_PERMISSION.COMMAND_REGISTRY, KEYMAP_PERMISSION.KEYMAP];

// Who declares keys and commands, as the core answers it: a host, by the name it gives, or a mod deck loads.
export function createProvider({ CORE, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.provider.handle(({ id }, sender) => {
            const mod = IDENTITY.modFrom(sender);
            if (!mod.permissions.some((permission) => READS.includes(permission.id)))
                throw Object.assign(new Error(`${mod.id} reads neither commands nor keys`), { kind: 'REFUSED' });
            return provider(id);
        });
    }

    // The provider of `id`, `{ id, name, host }`: a host that declared a command or registered a key, or a mod deck
    // loads. Null for neither.
    function provider(id) {
        return CORE.request('provider', { id });
    }

    // MARK: - Private
    return { start, provider };
}
