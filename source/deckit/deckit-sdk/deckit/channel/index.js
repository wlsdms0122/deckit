// How a channel between main and a page is declared, as plain data with nothing of an environment's: whichever
// environment carries it reads the same declaration.
// MARK: - Property
// What a field may be, written as is, or ending in `?` when it may be absent.
const KINDS = Object.freeze(['string', 'number', 'boolean', 'object', 'array', 'any']);
// Who may send on a channel a page sends main, besides a permission's id or a picker (pageToMain): ANY, any page, what
// it may ask judged by what answers it; MOD, a mod's page.
const GUARD = Object.freeze({ ANY: Symbol.for('deckit.guard.any-page'), MOD: Symbol.for('deckit.guard.mod-page') });

// MARK: - Initializer
// MARK: - Public
// What a page asks or tells main. `fields` is what it may send, each a kind (`string`, `number`, `boolean`, `object`,
// `array`, `any`), optional when it ends in `?`. A page runs code main does not trust, so main holds what arrives to
// them; nothing else checks. `guard` is who may send it: GUARD.ANY, GUARD.MOD, a permission's id, a mod's page granted
// it, or a picker, a function of the payload as sent that answers the id of the permission guarding that call, or null
// for none, a mod's page. A picker answers for any value it is handed and never throws.
function pageToMain(channel, fields, { reply = false, sync = false, guard } = {}) {
    return Object.freeze({ channel, to: 'main', fields: Object.freeze({ ...fields }), reply, sync, guard });
}

// What main tells or asks a page.
function mainToPage(channel, { reply = false } = {}) {
    return Object.freeze({ channel, to: 'page', reply });
}

// The id of the permission `guard` holds a call with `payload` to, or null for none.
function permissionOf(guard, payload) {
    if (typeof guard === 'function') return guard(payload);
    return typeof guard === 'string' ? guard : null;
}

// What `payload` holds under `key` as its own, or undefined for anything else: what a picker reads.
function fieldOf(payload, key) {
    return kindOf(payload) === 'object' && Object.hasOwn(payload, key) ? payload[key] : undefined;
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

// Why `declared` is not a channel declared as above, or '': what is bound may come from code that is not trusted.
function declarationProblem(declared) {
    if (kindOf(declared) !== 'object') return `a channel is declared as an object, not ${kindOf(declared)}`;
    const { channel, to, fields, reply, sync = false, guard } = declared;
    if (typeof channel !== 'string' || !channel) return 'a channel is declared with its name';
    if (to !== 'main' && to !== 'page') return `${channel} goes to main or to a page`;
    if (typeof reply !== 'boolean' || typeof sync !== 'boolean') return `${channel} says whether it is answered`;
    if (sync && (to !== 'main' || !reply)) return `${channel} is sync only as a page asks main`;
    if (to === 'page') return '';
    if (kindOf(fields) !== 'object') return `${channel} is declared with its fields`;
    for (const [key, written] of Object.entries(fields))
        if (typeof written !== 'string' || !KINDS.includes(written.replace(/\?$/, '')))
            return `${channel}'s ${key} is none of ${KINDS.join(', ')}`;
    const guarded =
        guard === GUARD.ANY ||
        guard === GUARD.MOD ||
        (typeof guard === 'string' && guard !== '') ||
        typeof guard === 'function';
    if (!guarded) return `${channel} is declared with its guard`;
    return '';
}

// Each of `declarations` (a protocol.js), by its name, bound with `channels`.
function bindAll(channels, declarations) {
    return Object.freeze(
        Object.fromEntries(Object.entries(declarations).map(([name, declared]) => [name, channels.bind(declared)]))
    );
}

// What a value is, as a field names it: `null`, `array`, or what `typeof` says.
function kindOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// MARK: - Private

export { GUARD, pageToMain, mainToPage, permissionOf, fieldOf, problemOf, declarationProblem, bindAll, kindOf };
