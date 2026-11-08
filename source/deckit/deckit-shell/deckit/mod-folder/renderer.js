import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// The requests deckit adds to `deckit.mods` (mods/renderer.js), each `{ signature, send }`.
// `pick(options)`: a folder the person picks to install, as it would install, or null when they did not pick one. With
// `multiple`, the folders they pick, each as it would install or, refused, `{ from, problem }`, none when they picked
// none.
const pick = Object.freeze({
    signature: [['options', 'object?', [['multiple', 'boolean?']]]],
    send: (options) => PROTOCOL.pick.invoke({ multiple: options?.multiple ?? false }),
});

// `reveal(id)`: the mod's folder, shown outside the app.
const reveal = Object.freeze({
    signature: [['id', 'string']],
    send: (id) => PROTOCOL.reveal.invoke({ id }),
});

// MARK: - Private

export { pick, reveal };
