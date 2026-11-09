import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The Dock in a mod's page, its channels bound with `channels`: `iconOf(mod)`, the icon a mod is listed with by its
// id, or '', and `mods`, what a mod with deckit.mods reads and changes of it: `list()`, every app mod as the Dock marks
// it, `pinned()`, the mods the person keeps in it, `setPinned(id, pinned)`, and `open(id)`, a mod as the person opens
// it.
function createDock({ channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const mods = Object.freeze({
        list: () => PROTOCOL.list.invoke(),
        pinned: () => PROTOCOL.pinned.invoke(),
        setPinned: (id, pinned) => PROTOCOL.setPinned.invoke({ id: String(id), pinned: !!pinned }),
        open: (id) => PROTOCOL.open.invoke({ id: String(id) }),
    });

    // MARK: - Public
    function iconOf(mod) {
        return PROTOCOL.icon.invoke({ mod: String(mod) });
    }

    return Object.freeze({ iconOf, mods });
}

// MARK: - Private

export { createDock };
