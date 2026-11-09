import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// `clipboard` for a handle, each member made a request with `request` (mod/renderer.js), guarded as its channel is.
function clipboardOf(request) {
    return Object.freeze({
        readText: request('clipboard.readText', { guard: PROTOCOL.readText.guard, signature: [] }, () =>
            PROTOCOL.readText.invoke()
        ),
        writeText: request(
            'clipboard.writeText',
            { guard: PROTOCOL.writeText.guard, signature: [['text', 'string']] },
            (text) => PROTOCOL.writeText.invoke({ text })
        ),
    });
}

// MARK: - Private

export { clipboardOf };
