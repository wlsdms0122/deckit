import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// `deckit` is what connect answered.
export function createDrop({ deckit, PAGES }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);

    // MARK: - Initializer
    // MARK: - Public
    // A mod's page is answered what was dropped on it, or on a surface it opened, alone.
    function start() {
        PROTOCOL.files.handle(({ surface }, sender) => {
            if (!deckit.mods.modOf(sender)) return [];
            const page = surface ? PAGES.surfaceOf(sender, surface) : sender;
            return page ? PAGES.droppedFiles(page) : [];
        });
    }

    // MARK: - Private
    return { start };
}
