import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = IPC.bindAll(DECLARED);

// What mods export to each other, as the core judges it: the core says whether a call goes, and its arguments and what
// it answers go from page to page through here.
export function createExport({ CORE, IDENTITY, RUNNER }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // A mod reaches another only through what that one exports, and only one it requires or has as an optional
    // dependency. A mod that starts waits until what it requires has started; its optional dependencies it does not
    // wait for, and it is told each time what they export to it changes. The function called hears who called it
    // (`deck.caller()`).
    function start() {
        RUNNER.handleEffect('optionalChanged', ({ mod, dependency, exports }) => {
            const page = IDENTITY.pageOf(mod);
            if (page) PROTOCOL.optionalChanged.send(page, { id: dependency, exports });
        });
        PROTOCOL.dependencies.handle(({ run }, sender) =>
            ready('export/dependencies', { mod: IDENTITY.modFrom(sender).id, run })
        );
        PROTOCOL.callExport.handle(async ({ run, mod, path, args }, sender) => {
            const caller = IDENTITY.modFrom(sender).id;
            await ready('export/call', { caller, run, mod, path });
            return PROTOCOL.exportCalled.invoke(IDENTITY.pageOf(mod), { caller, path, args });
        });
    }

    // MARK: - Private
    // What the core answers once it is ready, asked again each time the run it answered pending on has moved.
    async function ready(method, params) {
        for (;;) {
            const answer = await CORE.request(method, params);
            if (!answer.pending) return answer.ready;
            await RUNNER.whenMoved(answer.pending);
        }
    }

    return { start };
}
