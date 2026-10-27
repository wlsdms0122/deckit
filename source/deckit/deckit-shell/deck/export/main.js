import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What mods export to each other, as the core judges it: the core says whether a call goes, and its arguments and what
// it answers go from page to page through here.
export function createExport({ CORE, IDENTITY, RUNNER }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A mod reaches another only through what that one exports, and only one it requires, which runs before it loads.
    // The function called hears who called it (`caller()`).
    function start() {
        PROTOCOL.requires.handle(({ run }, sender) =>
            CORE.request('export/requires', { mod: IDENTITY.modFrom(sender).id, run })
        );
        PROTOCOL.callExport.handle(async ({ run, mod, path, args }, sender) => {
            const caller = IDENTITY.modFrom(sender).id;
            await CORE.request('export/call', { caller, run, mod, path });
            return PROTOCOL.exportCalled.invoke(IDENTITY.pageOf(mod), { caller, path, args });
        });
    }

    // MARK: - Private

    return { start };
}
