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
    // A mod reaches another only through what that one exports, and only one it requires or has as an optional
    // dependency. What it requires runs before it loads; it is told each time what its optional dependencies export to
    // it changes. The function called hears who called it (`deck.caller()`).
    function start() {
        RUNNER.handleEffect('optionalChanged', ({ mod, dependency, exports }) => {
            const page = IDENTITY.pageOf(mod);
            if (page) PROTOCOL.optionalChanged.send(page, { id: dependency, exports });
        });
        PROTOCOL.dependencies.handle(({ run }, sender) =>
            CORE.request('export/dependencies', { mod: IDENTITY.modFrom(sender).id, run })
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
