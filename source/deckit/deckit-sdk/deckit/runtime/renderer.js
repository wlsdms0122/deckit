import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// What the runtime adds to `deckit.mods`, each a request `{ guard, signature, send }`, `guard` its channel's.
const mods = Object.freeze({
    restart: Object.freeze({ guard: PROTOCOL.restart.guard, signature: [], send: () => PROTOCOL.restart.invoke() }),
    folders: Object.freeze({ guard: PROTOCOL.folders.guard, signature: [], send: () => PROTOCOL.folders.invoke() }),
});
// MARK: - Initializer
// MARK: - Public
function about() {
    return PROTOCOL.about.invoke();
}

// MARK: - Private

export { mods, about };
