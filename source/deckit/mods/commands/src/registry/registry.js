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
    // `NOT_PERMITTED`.
    function exportsFor(connection) {
        if (connection.credential.permissions.includes(SYSTEM_SERVICES)) return Object.freeze({ list, run, complete });
        const refuse = async () => {
            throw refusal('NOT_PERMITTED', `${connection.mod.name} does not hold ${SYSTEM_SERVICES}`);
        };
        return Object.freeze({ list: refuse, run: refuse, complete: refuse });
    }

    // Every mod's commands and the entries left out, `{ commands, refused }`, as `commandsOf` reads them.
    async function list() {
        const read = commandsOf(await declared);
        for (const { mod, problem } of read.refused) warn(`${mod.id}: ${problem}`);
        return read;
    }

    // The command `id` of the mod `mod`, run with `args` on the exports the mod opens for its id, reached for the run,
    // which launches it if it does not run: answers its result, a value or nothing, and rejects with why it did not run.
    async function run(mod, id, args) {
        if (typeof mod !== 'string' || typeof id !== 'string' || !isArgs(args))
            throw refusal('INVALID_ARGUMENT', 'run takes (mod, id, args), mod and id strings and args a table');
        const command = await declaredCommand(mod, id);
        const problem = problemOfArgs(command, args);
        if (problem) throw refusal('INVALID_ARGUMENT', `${command.title} cannot run: ${problem}`);
        const exports = await dependencies.reach(mod);
        let result;
        try {
            if (typeof exports.runCommand !== 'function')
                throw refusal('NOT_EXPORTED', `${command.mod.name} runs no commands: its exports have no runCommand`);
            result = await exports.runCommand(id, args ?? {});
        } finally {
            letGo(mod);
        }
        if (holdsFunction(result)) throw new Error(`${command.title} answered a function: a command answers a value`);
        return result ?? undefined;
    }

    // What the mod `mod` offers for the arg `param` of its command `id`, typed so far as `partial`, with `args` the args
    // filled so far: `[{ value, title, hint, keywords }]` as `completeCommand` on the exports the mod opens for its id
    // answers it, reached for the asking, which is refused as the run's is. A mod whose exports have no completeCommand
    // offers none.
    async function complete(mod, id, param, partial = '', args) {
        const strings = [mod, id, param, partial].every((one) => typeof one === 'string');
        if (!strings || !isArgs(args))
            throw refusal(
                'INVALID_ARGUMENT',
                'complete takes (mod, id, param, partial, args), each a string but args, a table'
            );
        const command = await declaredCommand(mod, id);
        if (!Object.hasOwn(command.params?.properties ?? {}, param))
            throw refusal('INVALID_ARGUMENT', `${command.title} takes no arg "${param}"`);
        const exports = await dependencies.reach(mod);
        let offered;
        try {
            if (typeof exports.completeCommand !== 'function') return [];
            offered = await exports.completeCommand(id, param, partial, args ?? {});
        } finally {
            letGo(mod);
        }
        if (!Array.isArray(offered) || holdsFunction(offered))
            throw new Error(`${command.title} answered no list of candidates for "${param}": candidates are JSON`);
        return offered;
    }

    // MARK: - Private
    async function declaredCommand(mod, id) {
        const command = (await list()).commands.find((each) => each.mod.id === mod && each.id === id);
        if (!command) throw refusal('NOT_DECLARED', `no such command: "${id}" of ${mod}`);
        return command;
    }

    function read() {
        return deckit.exports.contributions(INTERFACE);
    }

    // Whether `args` are a table of values, or left out.
    function isArgs(args) {
        return args == null || (typeof args === 'object' && !Array.isArray(args) && !holdsFunction(args));
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
