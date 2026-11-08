import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What mods declare to an interface under `interfaces` in their contributes, as the core hands it to the interface's
// owner: each entry with its mod and that mod's credential.
export function createContribution({ CORE, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.contributions.handle(({ interface: name }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            return CORE.request('interface/contributions', { mod: id, interface: name });
        });
    }

    // MARK: - Private
    return { start };
}
