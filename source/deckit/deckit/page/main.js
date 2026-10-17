import * as PROTOCOL from './protocol.js';

export function createPage({ CONFIG, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.setup.handle((_payload, sender) => {
            const page = IDENTITY.pageNameOf(sender);
            return page ? { page } : { id: CONFIG.id };
        });
    }

    // MARK: - Private

    return { start };
}
