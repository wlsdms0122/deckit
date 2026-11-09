import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What each page deckit makes is, answered to the page as it starts. `web` is what the environment gives of the web
// (environment: MAIN.web).
export function createSetup({ IDENTITY, web }) {
    // MARK: - Property
    const layers = []; // the layers stacked over deckit on each mod's page, each { name, setup }

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            const { id } = IDENTITY.modOf(sender);
            return {
                sessions: web.sessionsOf(id),
                layers: layers.map(({ name, setup }) => ({ name, setup: setup ? setup(id) : null })),
            };
        });
    }

    // A layer, by its name, stacks over deckit on each mod's page that starts from now on, once for a name.
    // `setup(id)`, where given, answers what the layer is handed on the page of the mod `id` as it starts.
    function stack(name, { setup = null } = {}) {
        if (!layers.some((one) => one.name === name)) layers.push({ name, setup });
    }

    // MARK: - Private

    return { start, stack };
}
