import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What each page deckit makes is, answered to the page as it starts.
export function createSetup({ IDENTITY }) {
    // MARK: - Property
    const layers = []; // the layers stacked over deckit on each mod's page, each { name, setup, keeps }

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            const { id } = IDENTITY.modOf(sender);
            return { layers: layers.map(({ name, setup }) => ({ name, setup: setup ? setup(id) : null })) };
        });
    }

    // A layer, by its name, stacks over deckit on each mod's page that starts from now on, once for a name.
    // `setup(id)`, where given, answers what the layer is handed on the page of the mod `id` as it starts. `keeps`,
    // where given, is what the layer keeps of a mod outside it: `kept(id)`, whether it keeps anything of the mod `id`,
    // and `erase(id) -> Promise`, that erased.
    function stack(name, { setup = null, keeps = null } = {}) {
        if (!layers.some((one) => one.name === name)) layers.push({ name, setup, keeps });
    }

    // The layers stacked, each `{ name, keeps }`, `keeps` null for one that keeps nothing of a mod outside deckit, in
    // the order they were stacked.
    function stacked() {
        return layers.map(({ name, keeps }) => ({ name, keeps }));
    }

    // MARK: - Private

    return { start, stack, stacked };
}
