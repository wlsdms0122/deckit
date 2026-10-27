import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as CONFIGURATION_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' configuration, as the core judges and keeps it.
export function createConfiguration({ CORE, LOG, IDENTITY, RUNNER }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // What a run declares the core cannot read, and the values saved that it does not take, are shown on its row; its
    // page is answered what its values read as.
    function start() {
        PROTOCOL.declare.handle(async ({ run, configuration }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            try {
                await RUNNER.ask('configuration/declare', { mod: id, run, configuration });
            } catch (error) {
                LOG.warn(`${id}: its configuration was not declared`, error);
                throw error;
            }
            return CORE.request('configuration/values', { mod: id });
        });
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
