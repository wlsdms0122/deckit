const { problemOfParams, problemOfValue } = require('./schema.js');

// MARK: - Property
// A command's id: letters, digits, "_" and "-".
const ID = /^[A-Za-z0-9_-]+$/;

// MARK: - Initializer
// MARK: - Public
// The commands in what mods declare to deckit/commands, as `contributions` answers it, `[{ mod, credential, entry }]`:
// `{ commands, refused }`, `commands` each `{ mod: { id, name }, id, title, keywords, params }`, in the mods' order and
// then the order declared, `params` left out for one that takes no args. An entry that cannot be used, or a second of one
// id from one mod, is left out, in `refused` as `{ mod, entry, problem }`.
function commandsOf(contributions) {
    const commands = [];
    const refused = [];
    const ids = new Set(); // "<mod id> <command id>"
    const refuse = (mod, entry, problem) => refused.push({ mod: { id: mod.id, name: mod.name }, entry, problem });
    for (const {
        mod: { name },
        credential,
        entry,
    } of contributions) {
        const mod = { id: credential.mod, name };
        const problem = problemOf(entry);
        if (problem) {
            refuse(mod, entry, `a command is left out: ${problem}`);
            continue;
        }
        const key = `${mod.id} ${entry.id}`;
        if (ids.has(key)) {
            refuse(mod, entry, `command "${entry.id}" is declared already, so a second one is left out`);
            continue;
        }
        ids.add(key);
        commands.push({
            mod: { id: mod.id, name: mod.name },
            id: entry.id,
            title: entry.title,
            keywords: entry.keywords ?? [],
            ...(entry.params !== undefined && { params: entry.params }),
        });
    }
    return { commands, refused };
}

// Why `args`, a table or left out, do not fit what `command` takes, or null. One that takes no args takes none or `{}`.
function problemOfArgs(command, args) {
    if (command.params === undefined)
        return args == null || (isObject(args) && !Object.keys(args).length) ? null : 'it takes no args';
    return problemOfValue(args ?? {}, command.params, 'args');
}

// Whether `value`, as it crossed a connection, holds a function, which is not JSON.
function holdsFunction(value) {
    if (typeof value === 'function') return true;
    if (!value || typeof value !== 'object') return false;
    return Object.values(value).some(holdsFunction);
}

// MARK: - Private
function problemOf(entry) {
    if (!isObject(entry)) return 'an entry is a table';
    if (typeof entry.id !== 'string' || !ID.test(entry.id))
        return `"${entry.id}" is no id: an id has letters, digits, "_" and "-"`;
    if (typeof entry.title !== 'string' || !entry.title.trim()) return `command "${entry.id}" needs a "title", text`;
    if (
        entry.keywords !== undefined &&
        !(Array.isArray(entry.keywords) && entry.keywords.every((word) => typeof word === 'string'))
    )
        return `command "${entry.id}" has "keywords" that are not a list of text`;
    const params = entry.params === undefined ? null : problemOfParams(entry.params);
    if (params) return `command "${entry.id}": its "params" ${params}`;
    return null;
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { commandsOf, problemOfArgs, holdsFunction };
