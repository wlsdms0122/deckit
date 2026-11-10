// MARK: - Property
// A setting's key: letters, digits, "_" and "-".
const KEY = /^[A-Za-z0-9_-]+$/;
// The types a setting is of, each with whether a value is one.
const TYPES = Object.freeze({
    string: (value) => typeof value === 'string',
    number: (value) => typeof value === 'number' && Number.isFinite(value),
    boolean: (value) => typeof value === 'boolean',
});

// MARK: - Initializer
// MARK: - Public
// The settings in what mods declare to deckit/configuration, as `contributions` answers it, `[{ mod, credential, entry
// }]`: `{ settings, refused }`, `settings` each `{ mod: { id, name }, key, entry }`, `entry` as written, in the mods'
// order and then the order declared. An entry that cannot be used, or a second of one key from one mod, is left out, in
// `refused` as `{ mod, entry, problem }`.
function settingsOf(contributions) {
    const settings = [];
    const refused = [];
    const keys = new Set(); // "<mod id> <key>"
    const refuse = (mod, entry, problem) => refused.push({ mod: { id: mod.id, name: mod.name }, entry, problem });
    for (const {
        mod: { name },
        credential,
        entry,
    } of contributions) {
        const mod = { id: credential.mod, name };
        const problem = problemOf(entry);
        if (problem) {
            refuse(mod, entry, `a setting is left out: ${problem}`);
            continue;
        }
        const key = `${mod.id} ${entry.key}`;
        if (keys.has(key)) {
            refuse(mod, entry, `setting "${entry.key}" is declared already, so a second one is left out`);
            continue;
        }
        keys.add(key);
        settings.push({ mod: { id: mod.id, name: mod.name }, key: entry.key, entry });
    }
    return { settings, refused };
}

// Why `value` is not one `setting` takes, or null: not of its type, none of its `oneOf`, or outside its `minimum` and
// `maximum`.
function problemOfValue(setting, value) {
    return problemOfValueIn(setting.entry, value);
}

// What `setting` reads as, given what is kept for its mod (key -> value): the value kept where it is one the setting
// takes, else its default, nothing where it declares none.
function valueOf(setting, kept) {
    const value = Object.hasOwn(kept, setting.key) ? kept[setting.key] : undefined;
    if (value !== undefined && !problemOfValue(setting, value)) return value;
    return setting.entry.default;
}

// MARK: - Private
function problemOf(entry) {
    if (!isObject(entry)) return 'an entry is a table';
    const { key, type, title, description, minimum, maximum, oneOf } = entry;
    if (typeof key !== 'string' || !KEY.test(key)) return `"${key}" is no key: a key has letters, digits, "_" and "-"`;
    if (!Object.hasOwn(TYPES, type)) return `setting "${key}" has a "type" of string, number or boolean`;
    if (typeof title !== 'string' || !title.trim()) return `setting "${key}" needs a "title", text`;
    if (description !== undefined && typeof description !== 'string')
        return `setting "${key}" has a "description" that is not text`;
    for (const [name, bound] of [
        ['minimum', minimum],
        ['maximum', maximum],
    ]) {
        if (bound === undefined) continue;
        if (type !== 'number') return `setting "${key}" is a ${type}, so it has no "${name}"`;
        if (!TYPES.number(bound)) return `setting "${key}" has a "${name}" that is not a number`;
    }
    if (minimum !== undefined && maximum !== undefined && minimum > maximum)
        return `setting "${key}" has a "minimum" above its "maximum"`;
    if (oneOf !== undefined) {
        if (!Array.isArray(oneOf) || !oneOf.length)
            return `setting "${key}" has a "oneOf" that is not a list of { const, title }`;
        for (const choice of oneOf) {
            if (!isObject(choice) || typeof choice.title !== 'string' || !choice.title.trim())
                return `setting "${key}" has a "oneOf" that is not a list of { const, title }`;
            const problem = problemOfValueIn({ type, minimum, maximum }, choice.const);
            if (problem) return `setting "${key}": a "oneOf" const ${problem}`;
        }
    }
    if (entry.default !== undefined) {
        const problem = problemOfValueIn(entry, entry.default);
        if (problem) return `setting "${key}": its "default" ${problem}`;
    }
    return null;
}

function problemOfValueIn({ type, minimum, maximum, oneOf }, value) {
    if (!TYPES[type](value)) return `${JSON.stringify(value) ?? String(value)} is not a ${type}`;
    if (oneOf && !oneOf.some((choice) => choice.const === value)) {
        const consts = oneOf.map((choice) => JSON.stringify(choice.const));
        return `${JSON.stringify(value)} is not one of ${consts.join(', ')}`;
    }
    if (minimum !== undefined && value < minimum) return `${value} is below the minimum, ${minimum}`;
    if (maximum !== undefined && value > maximum) return `${value} is above the maximum, ${maximum}`;
    return null;
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { settingsOf, problemOfValue, valueOf };
