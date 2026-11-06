import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as CONFIGURATION_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' configuration, as the core judges and keeps it.
export function createConfiguration({ CORE, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A mod's page is answered what its values read as.
    function start() {
        PROTOCOL.values.handle((_payload, sender) =>
            CORE.request('configuration/values', { mod: IDENTITY.modFrom(sender).id })
        );
        PROTOCOL.set.handle(({ key, value }, sender) => set(IDENTITY.modFrom(sender).id, key, value));
        PROTOCOL.list.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, CONFIGURATION_PERMISSION.MOD_CONFIGURATION);
            return CORE.request('configuration/list', {});
        });
        PROTOCOL.setOf.handle(({ mod, key, value }, sender) => {
            IDENTITY.modFrom(sender, CONFIGURATION_PERMISSION.MOD_CONFIGURATION);
            return set(mod, key, value);
        });
    }

    // MARK: - Private
    // The mod's page is told of a value that changed.
    async function set(modId, key, value) {
        const { value: next, changed } = await CORE.request('configuration/set', { mod: modId, key, value });
        const page = IDENTITY.pageOf(modId);
        if (changed && page) PROTOCOL.changed.send(page, { key, value: next ?? null });
        return next ?? null;
    }

    return { start };
}
