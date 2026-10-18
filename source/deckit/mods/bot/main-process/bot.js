// The bot's forge daemons and brain, where its settings say each is: `use(settings)` gives them, before anything is
// asked and again when one changes, and answers which of the two are served anew. A command left empty is the one on the login shell's PATH, and `~` at the start
// of a path is the home folder.
module.exports = ({ id, emit }) => {
    const os = require('os');
    const path = require('path');
    const commands = require('./command.js')();
    // One part of the bot, served by `make(at, { track, live })` for where its settings say it is, apart from the
    // other: when they change, the commands it still runs end, those they would start after end at once, and what it
    // reports is no longer sent. `use(at)` answers whether it is served anew.
    const part = (name, make) => {
        let served = null; // { key, children, live, value }
        const retire = () => {
            if (!served) return;
            served.live.on = false;
            for (const child of served.children) child.kill();
            served = null;
        };
        return {
            use(at) {
                const key = JSON.stringify(at);
                if (served && served.key === key) return false;
                retire();
                const children = new Set();
                const live = { on: true };
                const track = (child) => {
                    if (!live.on) return child.kill();
                    children.add(child);
                    child.once('close', () => children.delete(child));
                };
                served = { key, children, live, value: make(at, { track, live: () => live.on }) };
                return true;
            },
            value() {
                if (!served) throw new Error(`Bot is not serving ${name}: the mod has not started or has stopped`);
                return served.value;
            },
            retire,
        };
    };
    // What a part serves, or why its settings do not hold.
    const held = (value) => {
        if (value.problem) throw new Error(value.problem);
        return value;
    };
    // Methods that answer from whatever is served when they are called.
    const through = (read, names) =>
        Object.fromEntries(names.map((name) => [name, async (...args) => read()[name](...args)]));

    // Forge's settings that do not hold stand for the daemons: the supervisor's methods tell the problem, and the
    // reports carry it as their error.
    const forge = part('forge', (at, { track, live }) => {
        const send = (name) => (state) => live() && emit(name, state);
        const daemons = at.problem ? at : require('./forge/supervisor.js')({ ...at, id, track, live, commands });
        return {
            supervisor: at.problem ? at : daemons.methods,
            tasks: require('./forge/tasks.js')({ forge: daemons, send: send('tasks') }),
            release: require('./forge/release.js')({ forge: daemons, send: send('release') }),
        };
    });
    const brain = part('the brain', (at, { track }) =>
        at.problem ? at : require('./llmemory/brain.js')({ ...at, track, commands })
    );
    let used = false;

    const expand = (value) =>
        String(value ?? '')
            .trim()
            .replace(/^~(?=$|\/)/, os.homedir());
    // A command: a name looked up on the PATH, or a full path.
    const commandOf = (value, name) => {
        const given = expand(value) || name;
        if (!given.includes('/')) return given;
        if (!path.isAbsolute(given)) throw new Error(`the ${name} command is not a name or a full path: ${value}`);
        return path.resolve(given);
    };
    const fileOf = (value, what) => {
        const given = expand(value);
        if (given && !path.isAbsolute(given)) throw new Error(`${what} is not a full path: ${value}`);
        return given ? path.resolve(given) : null;
    };
    // Where one part is, or the problem with its settings.
    const where = (read) => {
        try {
            return read();
        } catch (error) {
            return { problem: error.message };
        }
    };

    return {
        use(settings) {
            const forgeAt = where(() => ({
                command: commandOf(settings.forge, 'forge'),
                config: fileOf(settings.forgeConfig, "forge's configuration"),
            }));
            const brainAt = where(() => {
                const home = fileOf(settings.brain, "the brain's folder");
                if (!home) throw new Error("the brain's folder is not set: give it in Settings");
                return { command: commandOf(settings.llmemory, 'llmemory'), home };
            });
            const renewed = { forge: forge.use(forgeAt), brain: brain.use(brainAt) };
            // What other mods hear starts again with the new forge settings' reports.
            if (used && renewed.forge) {
                emit('tasks', forge.value().tasks.state());
                emit('release', forge.value().release.state());
            }
            used = true;
            return renewed;
        },
        forge: {
            supervisor: through(
                () => held(forge.value().supervisor),
                ['call', 'runSchedule', 'sessions', 'session', 'start', 'stop', 'restart', 'log']
            ),
            tasks: through(() => forge.value().tasks, ['state', 'check', 'sync']),
            release: through(() => forge.value().release, ['state', 'check']),
        },
        brain: through(() => held(brain.value()), ['search', 'list', 'axes', 'get', 'related']),
        // The daemons it started are the person's and run on after the app; the commands it runs end with it.
        dispose: () => {
            forge.retire();
            brain.retire();
            commands.end();
        },
    };
};
