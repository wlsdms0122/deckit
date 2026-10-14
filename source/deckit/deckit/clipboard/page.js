import * as PROTOCOL from './protocol.js';

// MARK: - Property
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
