import * as PROTOCOL from './protocol.js';

export function createPage({ IDENTITY, PARTITION }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            if (page) return { page };
            // What a mod's page needs of the configuration, worked out here: how its web sessions are spelled.
            return { sessionPrefix: PARTITION.prefixOf(IDENTITY.modOf(sender).id) };
        });
    }

    // MARK: - Private

    return { start };
}
