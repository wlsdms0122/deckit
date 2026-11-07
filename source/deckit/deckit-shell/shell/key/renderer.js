import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// `shell.keys` for a mod with deckit.shell-keys, its channels bound with `channels`: `list()` answers the shell's keys,
// `[{ id, name, defaultKeystroke, keystroke }]`, at once; `set(id, keystroke)` gives one a chord, `{ code, meta,
// control, alt, shift }`, or none for null, and `reset(id)` its default again, each resolving to the key as kept.
function tool({ channels }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    return Object.freeze({
        list: () => PROTOCOL.list.invoke(),
        set: (id, keystroke) => PROTOCOL.set.invoke({ id: String(id), keystroke: keystroke ?? null }),
        reset: (id) => PROTOCOL.reset.invoke({ id: String(id) }),
    });
}

// MARK: - Private

export { tool };
