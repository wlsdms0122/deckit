import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The Dock on one handle in a mod's page, its channels bound with `channels`, `request` making each of its requests as
// the handle guards them: `mods`, what a mod reads and changes of it, each a request: `icon(id)`, the icon of any mod,
// open to every mod, and, for a mod with deckit.mods, `list()`, every app mod as the Dock marks it, `pinned()`, the
// mods the person keeps in it, `setPinned(id, pinned)`, and `open(id)`, a mod as the person opens it.
function createDock({ channels, request }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const mods = Object.freeze({
        list: request('mods.list', { guard: PROTOCOL.list.guard }, () => PROTOCOL.list.invoke()),
        icon: request('mods.icon', { guard: PROTOCOL.icon.guard, signature: [['id', 'string']] }, (id) =>
            PROTOCOL.icon.invoke({ id })
        ),
        pinned: request('mods.pinned', { guard: PROTOCOL.pinned.guard }, () => PROTOCOL.pinned.invoke()),
        setPinned: request(
            'mods.setPinned',
            {
                guard: PROTOCOL.setPinned.guard,
                signature: [
                    ['id', 'string'],
                    ['pinned', 'boolean'],
                ],
            },
            (id, pinned) => PROTOCOL.setPinned.invoke({ id, pinned })
        ),
        open: request('mods.open', { guard: PROTOCOL.open.guard, signature: [['id', 'string']] }, (id) =>
            PROTOCOL.open.invoke({ id })
        ),
    });

    return Object.freeze({ mods });
}

// MARK: - Private

export { createDock };
