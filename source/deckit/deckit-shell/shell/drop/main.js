import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';

// `deckit` is what connect answered.
export function createDrop({ deckit, PAGES }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);

    // MARK: - Initializer
    // MARK: - Public
    // A mod's page is answered what was dropped on it alone.
    function start() {
        PROTOCOL.files.handle((_payload, sender) => (deckit.mods.modOf(sender) ? PAGES.droppedFiles(sender) : []));
    }

    // MARK: - Private
    return { start };
}
