// How a channel between main and a page is declared, as plain data with nothing of Electron's: whichever driver carries
// it reads the same declaration.
// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What a page asks or tells main. `fields` is what it may send, each a kind (`string`, `number`, `boolean`, `object`,
// `array`, `any`), optional when it ends in `?`. A page runs code main does not trust, so main holds what arrives to
// them; nothing else checks.
function rendererToMain(channel, fields, { reply = false, sync = false } = {}) {
    return Object.freeze({ channel, to: 'main', fields: Object.freeze({ ...fields }), reply, sync });
}

// What main tells or asks a page.
function mainToRenderer(channel, { reply = false } = {}) {
    return Object.freeze({ channel, to: 'renderer', reply });
}

// Why `payload` is not what the channel carries, or ''.
function problemOf({ channel, fields }, payload) {
    if (kindOf(payload) !== 'object') return `${channel} carries an object, not ${kindOf(payload)}`;
    for (const key of Object.keys(payload)) {
        if (!Object.hasOwn(fields, key)) return `${channel} has no field ${key}`;
    }
    for (const [key, written] of Object.entries(fields)) {
        const optional = written.endsWith('?');
        const type = optional ? written.slice(0, -1) : written;
        const value = payload[key];
        if (value === undefined || value === null) {
            if (!optional) return `${channel} needs ${key}`;
            continue;
        }
        if (type !== 'any' && kindOf(value) !== type) return `${channel}'s ${key} is ${kindOf(value)}, not ${type}`;
    }
    return '';
}

// MARK: - Private
function kindOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

export { rendererToMain, mainToRenderer, problemOf };
