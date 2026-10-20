import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
function readText() {
    return PROTOCOL.readText.invoke();
}

function writeText(text) {
    return PROTOCOL.writeText.invoke({ text: String(text ?? '') });
}

// MARK: - Private

export { readText, writeText };
