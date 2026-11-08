const { WIDE_RULE, parse, chordOf, same, fitsWide } = require('../keystroke/keystroke.js');

// MARK: - Property
// Where a key works, as a person reads it: `app` anywhere in the app, `global` in every app too.
const SCOPES = Object.freeze({ app: 'anywhere in the app', global: 'in every app' });
// What the declaring mod is granted for a key of each scope.
const GRANTS = Object.freeze({ app: 'deckit.app-keys', global: 'system.global-keys' });

// MARK: - Initializer
// MARK: - Public
// The keys in what mods declare to deckit/keys, as `contributions` answers it, `[{ mod, credential, entry }]`, each for
// a command of its mod's in `commands`, as deckit/commands lists them: `{ mod: { id, name }, command, title, scope,
// defaultKeystroke }`, in the mods' order and then the order declared. An entry that cannot be used, one of a scope its
// mod is not granted, or a second key for one command, is told to `warn` and left out.
function keysOf(contributions, commands, warn) {
    const keys = [];
    const ids = new Set(); // "<mod id> <command id>"
    for (const { mod, credential, entry } of contributions) {
        const command = isObject(entry)
            ? commands.find((each) => each.mod.id === mod.id && each.id === entry.command)
            : null;
        const problem = problemOf(entry, command, mod, credential);
        if (problem) {
            warn(`${mod.id}: a key is left out: ${problem}`);
            continue;
        }
        const key = `${mod.id} ${entry.command}`;
        if (ids.has(key)) {
            warn(`${mod.id}: a key for "${entry.command}" is declared already, so a second one is left out`);
            continue;
        }
        ids.add(key);
        keys.push({
            mod: { id: mod.id, name: mod.name },
            command: entry.command,
            title: command.title,
            scope: entry.scope ?? 'app',
            defaultKeystroke: parse(entry.keystroke),
        });
    }
    return keys;
}

// The bindings of `keys`, each bound to its default or to what a person set in `changes`, `[{ mod, command,
// keystroke }]` in the order made, `keystroke` a spec or '' for none. In the order a chord tries them, `app` before
// `global`. Each is `{ mod, command, title, scope, defaultKeystroke, keystroke, chord, changed, active, issues }`:
// `keystroke` null for none, `chord` it as a person reads it, `changed` whether it is not its default, `active` whether
// a press of its chord runs it, and `issues` `[{ kind, message, other }]` why it does not, or how it is held back.
//
// Of the bindings of one scope on one chord, defaults are applied first and then changes in the order made: a change
// onto a chord one applied already has is held back (`held`), and of defaults on one chord the first listed runs, the
// others `shadowed`. A key of `app` and one of `global` on one chord do not contend.
function resolved(keys, changes) {
    const list = [
        ...keys.filter(({ scope }) => scope === 'app'),
        ...keys.filter(({ scope }) => scope === 'global'),
    ].map((key) => bindingOf(key, changes));
    const rank = (index) => (list[index].changed ? changes.findIndex((change) => isOf(change, list[index])) : -1);
    const order = list.map((_, index) => index).sort((one, other) => rank(one) - rank(other) || one - other);
    const accepted = [];
    for (const index of order) {
        const binding = list[index];
        if (!binding.keystroke) continue;
        const holder = accepted.find((other) => contends(list[other], binding));
        if (holder !== undefined && binding.changed) {
            const other = list[holder];
            const where = `${nameOf(other)} ${SCOPES[other.scope]}`;
            binding.issues.push(
                issue('held', `${binding.chord} is the chord of ${where}: this waits until it is free`, other)
            );
            continue;
        }
        accepted.push(index);
    }
    for (const index of accepted) {
        const first = accepted.find((other) => other < index && contends(list[other], list[index]));
        if (first === undefined) {
            list[index].active = true;
            continue;
        }
        const other = list[first];
        list[index].issues.push(issue('shadowed', `${nameOf(other)} takes ${other.chord} first`, other));
    }
    return list;
}

// Why `keystroke`, a key a person sets for `binding`, cannot be its chord, or null.
function problemOfKeystroke(keystroke, binding) {
    if (!chordOf(keystroke)) return 'that key cannot be bound';
    if (!fitsWide(keystroke)) return `${chordOf(keystroke)} cannot work ${SCOPES[binding.scope]}: ${WIDE_RULE}`;
    return null;
}

// Whether `change`, `{ mod, command }`, is of `binding`.
function isOf(change, binding) {
    return change.mod === binding.mod.id && change.command === binding.command;
}

function issue(kind, message, other = null) {
    return {
        kind,
        message,
        other: other && { mod: other.mod, command: other.command, title: other.title },
    };
}

// MARK: - Private
function problemOf(entry, command, mod, credential) {
    if (!isObject(entry)) return 'an entry is a table';
    if (typeof entry.command !== 'string' || !entry.command) return 'a key needs "command", the id of a command';
    const of = `the key for "${entry.command}"`;
    if (!command) return `${of}: ${mod.id} declares no such command`;
    if (command.params?.required?.length)
        return `${of}: a key runs its command with no args, and it needs ${command.params.required.join(', ')}`;
    if (entry.scope !== undefined && !Object.hasOwn(SCOPES, entry.scope))
        return `${of}: its "scope" is ${Object.keys(SCOPES).join(' or ')}`;
    const scope = entry.scope ?? 'app';
    if (!credential.permissions.includes(GRANTS[scope]))
        return `${of} works ${SCOPES[scope]}, which needs ${GRANTS[scope]}, and ${mod.id} is not granted it`;
    if (typeof entry.keystroke !== 'string' || !entry.keystroke.trim()) return `${of} needs a chord in "keystroke"`;
    const keystroke = parse(entry.keystroke);
    if (!keystroke) return `${of}: "${entry.keystroke}" is not a chord`;
    if (!fitsWide(keystroke)) return `${of} cannot work ${SCOPES[scope]}: ${WIDE_RULE}`;
    return null;
}

function bindingOf(key, changes) {
    const change = changes.find((each) => isOf(each, key));
    const keystroke = change ? (change.keystroke ? parse(change.keystroke) : null) : key.defaultKeystroke;
    return {
        ...key,
        keystroke,
        chord: keystroke ? chordOf(keystroke) : '',
        changed: !!change && !same(keystroke, key.defaultKeystroke),
        active: false,
        issues: [],
    };
}

// Whether both work in the same place on one chord, so that only one of them runs.
function contends(one, other) {
    return one.scope === other.scope && same(one.keystroke, other.keystroke);
}

function nameOf(binding) {
    return `${binding.title} of ${binding.mod.name}`;
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { SCOPES, keysOf, resolved, problemOfKeystroke, isOf, issue };
