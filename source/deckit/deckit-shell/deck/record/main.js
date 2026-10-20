import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's records are the core's to keep: JSON by key, which the core keeps as the text it is handed.
export function createRecord({ CORE, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A mod reaches its own records and no one else's: which ones is who asked.
    function start() {
        PROTOCOL.readRecord.handle(async ({ key }, sender) => {
            const text = await CORE.request('record/read', { mod: IDENTITY.modFrom(sender).id, key });
            return text === null ? null : valueOf(text);
        });
        PROTOCOL.writeRecord.handle(async ({ key, value }, sender) => {
            await CORE.request('record/write', { mod: IDENTITY.modFrom(sender).id, key, text: JSON.stringify(value) });
            return true;
        });
        PROTOCOL.removeRecord.handle(async ({ key }, sender) => {
            await CORE.request('record/remove', { mod: IDENTITY.modFrom(sender).id, key });
            return true;
        });
        PROTOCOL.recordKeys.handle((_payload, sender) =>
            CORE.request('record/keys', { mod: IDENTITY.modFrom(sender).id })
        );
    }

    // How many files the mod's records are, `{ count, hidden }`.
    function count(modId) {
        return CORE.request('record/count', { mod: modId });
    }

    // MARK: - Private
    // A record whose file is not JSON (one edited by hand) holds no value.
    function valueOf(text) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    return { start, count };
}
