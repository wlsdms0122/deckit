const { keysOf, resolved, problemOfKeystroke, isOf, issue } = require('../binding/binding.js');
const { keystrokeOf, specOf, parse, same } = require('../keystroke/keystroke.js');
const { chords } = require('../chords/chords.js');

// MARK: - Property
const INTERFACE = 'deckit/keys';
const COMMANDS = 'deckit/commands';
// The signals of an interface after which what is declared to it is read again.
const SIGNALS = ['contributions-changed', 'owner-changed'];
// What a client holds to list every binding and set one.
const SYSTEM_SERVICES = 'deckit.system-services';
// The record of what a person set: `[{ mod, command, keystroke }]` in the order made, `keystroke` a spec or '' for
// none.
const KEPT = 'keys';

// MARK: - Initializer
// MARK: - Public
// The keys mods declare to deckit/keys, bound to their defaults or to what a person set, kept in the mod's records,
// each chord taken through the keys hole, and a press running its command through deckit/commands. What is declared to
// deckit/keys is read as the keymap starts and again on its signals, and the commands as deckit/commands connects and
// again as what is declared to it changes; the chords are taken again after each. `deckit` is the function
// lifecycle's handle.
function keymap(deckit) {
    // MARK: - Property
    const records = deckit.storage.records;
    const taken = chords(deckit.keys, press);
    const warned = new Set(); // what was told about a declaration, told once
    let changes = changesOf(records.get(KEPT, []));
    let commands = null; // deckit/commands' exports, while connected
    let declared = read(); // what is declared to deckit/keys, as last read
    let listed = null; // the commands deckit/commands lists, as last read while it is connected
    let bindings = []; // as last resolved
    let queue = Promise.resolve(); // the work under way, which the next waits for

    // MARK: - Initializer
    deckit.dependencies.onConnect(COMMANDS, (exports) => {
        commands = exports;
        listed = exports.list();
        retake();
        return () => {
            if (commands !== exports) return;
            commands = null;
            listed = null;
        };
    });
    for (const signal of SIGNALS)
        deckit.events.on(`${INTERFACE}:${signal}`, () => {
            declared = read();
            if (commands) retake();
        });
    deckit.events.on(`${COMMANDS}:contributions-changed`, () => {
        if (!commands) return;
        listed = commands.list();
        retake();
    });

    // MARK: - Public
    // The exports for a connection: a client that does not hold deckit.system-services reads its own mod's chords, and
    // is refused the rest, kind `REFUSED`.
    function exportsFor(connection) {
        const own = connection.credential.mod;
        const chordOf = async (command) => {
            await queue;
            return bindings.find((binding) => binding.active && isOf({ mod: own, command }, binding))?.chord ?? '';
        };
        if (connection.credential.permissions.includes(SYSTEM_SERVICES))
            return Object.freeze({ list, set, reset, chordOf });
        const refuse = async () => {
            throw refusal('REFUSED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ list: refuse, set: refuse, reset: refuse, chordOf });
    }

    // Every binding, as `resolved` answers it, with what the keys hole answered: `taken` for a chord another mod
    // holds, which runs none of them, and `unavailable` for one the system did not give outside the app.
    function list() {
        return serial(refresh);
    }

    // The binding of `mod`'s key for `command` bound to `keystroke`, `{ code, meta, control, alt, shift }`, or to none
    // for null. Answers the binding.
    function set(mod, command, keystroke) {
        return serial(async () => {
            const binding = await bindingOf(mod, command);
            const read = keystroke == null ? null : keystrokeOf(keystroke);
            if (keystroke != null && !read)
                throw refusal('KEYSTROKE', 'a key is set to a keystroke with a code, or null');
            const problem = read && problemOfKeystroke(read, binding);
            if (problem) throw refusal('KEYSTROKE', problem);
            const next = changes.filter((change) => !isOf(change, binding));
            if (!same(read, binding.defaultKeystroke)) next.push({ mod, command, keystroke: read ? specOf(read) : '' });
            return keep(next, binding);
        });
    }

    // The binding of `mod`'s key for `command` back to its default. Answers the binding.
    function reset(mod, command) {
        return serial(async () => {
            const binding = await bindingOf(mod, command);
            return keep(
                changes.filter((change) => !isOf(change, binding)),
                binding
            );
        });
    }

    // MARK: - Private
    function read() {
        return deckit.exports.contributions(INTERFACE);
    }

    function retake() {
        serial(refresh).catch((error) => console.error('[keymap] the keys were not taken', error));
    }

    // The bindings resolved again from what is declared, and the chords taken made theirs.
    async function refresh() {
        if (!commands) throw refusal('NOT_RUNNING', `${COMMANDS} is not connected, so no command is known`);
        const next = resolved(keysOf(await declared, await listed, warn), changes);
        const wanted = new Map(); // spec -> { keystroke, scope }, `global` where any on it is
        for (const binding of next) {
            const spec = binding.active && specOf(binding.keystroke);
            if (spec && (!wanted.has(spec) || binding.scope === 'global'))
                wanted.set(spec, { keystroke: binding.keystroke, scope: binding.scope });
        }
        const outcomes = await taken.match(wanted);
        for (const binding of next) {
            if (!binding.active) continue;
            const outcome = outcomes.get(specOf(binding.keystroke));
            if (outcome.problem) {
                binding.active = false;
                binding.issues.push(issue('taken', outcome.problem));
            } else if (!outcome.held && binding.scope === 'global') {
                const why = `the system did not give ${binding.chord} to the app outside it: it works in the app only`;
                binding.issues.push(issue('unavailable', why));
            }
        }
        bindings = next;
        return bindings;
    }

    async function bindingOf(mod, command) {
        const binding = (await refresh()).find((each) => isOf({ mod, command }, each));
        if (!binding) throw refusal('KEY', `${mod} declares no key for "${command}"`);
        return binding;
    }

    // `next` kept as what a person set, and the bindings resolved again: answers `binding` as it is now.
    async function keep(next, binding) {
        await records.set(KEPT, next);
        changes = next;
        return (await refresh()).find((each) => isOf({ mod: binding.mod.id, command: binding.command }, each));
    }

    // A press of the chord `spec` runs its binding's command: of an `app` and a `global` one on it, the `app` one while
    // the app is in front. What the run throws is only logged: no one asked to be told.
    async function press(spec) {
        const on = bindings.filter((binding) => binding.active && specOf(binding.keystroke) === spec);
        const app = on.find((binding) => binding.scope === 'app');
        const global = on.find((binding) => binding.scope === 'global');
        const binding = app && global ? ((await deckit.active()) ? app : global) : (app ?? global);
        if (!binding) return;
        const name = `${binding.title} of ${binding.mod.name}`;
        if (!commands) return console.warn(`[keymap] ${name} did not run: ${COMMANDS} is not connected`);
        try {
            await commands.run(binding.mod.id, binding.command);
        } catch (error) {
            console.warn(`[keymap] ${name} did not run: ${error.message || error}`);
        }
    }

    function serial(work) {
        const run = queue.then(work);
        queue = run.catch(() => {});
        return run;
    }

    function warn(problem) {
        if (warned.has(problem)) return;
        warned.add(problem);
        console.warn(`[keymap] ${problem}`);
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    return Object.freeze({ exportsFor });
}

// MARK: - Private
// What a person set, as the record holds it: an entry of another shape, or a spec that is no chord, is left out.
function changesOf(read) {
    if (!Array.isArray(read)) return [];
    return read.filter(
        (change) =>
            !!change &&
            typeof change.mod === 'string' &&
            typeof change.command === 'string' &&
            typeof change.keystroke === 'string' &&
            (change.keystroke === '' || !!parse(change.keystroke))
    );
}

module.exports = { keymap, INTERFACE };
