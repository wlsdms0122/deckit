import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = IPC.bindAll(DECLARED);
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
