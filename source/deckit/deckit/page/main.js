import * as PROTOCOL from './protocol.js';

export function createPage({ CONFIG, IDENTITY, PARTITION }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            // What a mod's page needs of the configuration, worked out here: whether it is the host app's own mod,
            // and how its web sessions are spelled.
            const mod = IDENTITY.modOf(sender);
            return { hostMod: mod.id === CONFIG.id, sessionPrefix: PARTITION.prefixOf(mod.id) };
        });
    }

    // MARK: - Private

    return { start };
}
