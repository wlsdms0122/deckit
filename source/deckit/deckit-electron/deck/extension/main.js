import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = IPC.bindAll(DECLARED);

// Extension points, as the core judges them: the core says whether a point's mod's call into what extends it goes, and
// its arguments and what it answers go from page to page through here. A point's mod is told what extends its points
// as the core tells it.
export function createExtension({ CORE, IDENTITY, RUNNER }) {
    // MARK: - Property
    const extending = new Map(); // mod id -> the scoped names of the points it extends, as the core told it

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.handleEffect('extensionsChanged', ({ mod, name, extensions }) => {
            const page = IDENTITY.pageOf(mod);
            if (page) PROTOCOL.extensionsChanged.send(page, { name, extensions });
        });
        RUNNER.handleEffect('extendsChanged', ({ mod, points }) => {
            if (points.length) extending.set(mod, points);
            else extending.delete(mod);
        });
        PROTOCOL.callExtension.handle(async ({ run, mod, point, path, args }, sender) => {
            await CORE.request('extension/call', { caller: IDENTITY.modFrom(sender).id, run, mod, point, path });
            return PROTOCOL.extensionCalled.invoke(IDENTITY.pageOf(mod), { point, path, args });
        });
    }

    // The points the mod extends now.
    function pointsExtendedBy(modId) {
        return extending.get(modId) || [];
    }

    // MARK: - Private

    return { start, pointsExtendedBy };
}
