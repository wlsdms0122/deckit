const { commandsOf, problemOfArgs, holdsFunction } = require('../command/command.js');

// MARK: - Property
const INTERFACE = 'deckit/commands';
// What a client holds to list the mods' commands and run them.
const SYSTEM_SERVICES = 'deckit.system-services';
// The signals of the interface after which what is declared to it is read again.
const SIGNALS = ['contributions-changed', 'owner-changed'];

// MARK: - Initializer
// MARK: - Public
// The commands mods declare to deckit/commands, read as it starts and again on the interface's signals, and run on the
// exports their mod opens for its id. `deckit` is the function lifecycle's handle.
function registry(deckit) {
    // MARK: - Property
    const { dependencies } = deckit;
    const warned = new Set(); // what was told about a declaration, told once
    let declared = read(); // what is declared to deckit/commands, as last read

    // MARK: - Initializer
    for (const signal of SIGNALS) deckit.events.on(`${INTERFACE}:${signal}`, () => (declared = read()));

    // MARK: - Public
    // The exports for a connection: a client that does not hold deckit.system-services is refused each call, kind
    // `REFUSED`.
    function exportsFor(connection) {
        if (connection.credential.permissions.includes(SYSTEM_SERVICES)) return Object.freeze({ list, run });
        const refuse = async () => {
            throw refusal('REFUSED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ list: refuse, run: refuse });
    }

    // Every mod's commands and the entries left out, `{ commands, refused }`, as `commandsOf` reads them.
    async function list() {
        const read = commandsOf(await declared);
        for (const { mod, problem } of read.refused) warn(`${mod.id}: ${problem}`);
        return read;
    }

    // The command `id` of the mod `mod`, run with `args` on the exports the mod opens for its id, reached for the run,
    // which launches it if it does not run: answers its result, JSON or null, and rejects with why it did not run.
    async function run(mod, id, args = null) {
        const command = (await list()).commands.find((each) => each.mod.id === mod && each.id === id);
        if (!command) throw refusal('COMMAND', `no such command: "${id}" of ${mod}`);
        const problem = problemOfArgs(command, args);
        if (problem) throw refusal('ARGUMENTS', `${command.title} cannot run: ${problem}`);
        const exports = await dependencies.reach(mod);
        let result;
        try {
            if (typeof exports.runCommand !== 'function')
                throw refusal('COMMAND', `${command.mod.name} runs no commands: its exports have no runCommand`);
            result = await exports.runCommand(id, args ?? {});
        } finally {
            letGo(mod);
        }
        if (holdsFunction(result)) throw new Error(`${command.title} answered a function: a command answers JSON`);
        return result ?? null;
    }

    // MARK: - Private
    function read() {
        return deckit.exports.contributions(INTERFACE);
    }

    function letGo(mod) {
        dependencies.release(mod).catch((error) => console.error(`[commands] ${mod} was not let go`, error));
    }

    function warn(problem) {
        if (warned.has(problem)) return;
        warned.add(problem);
        console.warn(`[commands] ${problem}`);
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    return Object.freeze({ exportsFor });
}

module.exports = { registry, INTERFACE };
