// How a channel between main and a page is declared, as plain data with nothing of a driver's: whichever driver carries
// it reads the same declaration.
// MARK: - Property
// What a field may be, written as is, or ending in `?` when it may be absent.
const KINDS = ['string', 'number', 'boolean', 'object', 'array', 'any'];

// MARK: - Initializer
// MARK: - Public
// What a page asks or tells main. `fields` is what it may send, each a kind (`string`, `number`, `boolean`, `object`,
// `array`, `any`), optional when it ends in `?`. A page runs code main does not trust, so main holds what arrives to
// them; nothing else checks.
function pageToMain(channel, fields, { reply = false, sync = false } = {}) {
    return Object.freeze({ channel, to: 'main', fields: Object.freeze({ ...fields }), reply, sync });
}

// What main tells or asks a page.
function mainToPage(channel, { reply = false } = {}) {
    return Object.freeze({ channel, to: 'page', reply });
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

// Why `declared` is not a channel declared as above, or '': what a driver binds may come from code it does not trust.
function declarationProblem(declared) {
    if (kindOf(declared) !== 'object') return `a channel is declared as an object, not ${kindOf(declared)}`;
    const { channel, to, fields, reply, sync = false } = declared;
    if (typeof channel !== 'string' || !channel) return 'a channel is declared with its name';
    if (to !== 'main' && to !== 'page') return `${channel} goes to main or to a page`;
    if (typeof reply !== 'boolean' || typeof sync !== 'boolean') return `${channel} says whether it is answered`;
    if (sync && (to !== 'main' || !reply)) return `${channel} is sync only as a page asks main`;
    if (to === 'page') return '';
    if (kindOf(fields) !== 'object') return `${channel} is declared with its fields`;
    for (const [key, written] of Object.entries(fields))
        if (typeof written !== 'string' || !KINDS.includes(written.replace(/\?$/, '')))
            return `${channel}'s ${key} is none of ${KINDS.join(', ')}`;
    return '';
}

// Each of `declarations` (a protocol.js), by its name, bound with `channels`.
function bindAll(channels, declarations) {
    return Object.freeze(
        Object.fromEntries(Object.entries(declarations).map(([name, declared]) => [name, channels.bind(declared)]))
    );
}

// MARK: - Private
function kindOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

export { pageToMain, mainToPage, problemOf, declarationProblem, bindAll };
