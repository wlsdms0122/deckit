// The bot's forge daemons and brain, where its settings say each is: `use(settings)` gives them, before anything is
// asked and again when one changes. A command left empty is the one on the login shell's PATH, and `~` at the start
// of a path is the home folder.
module.exports = ({ id, emit }) => {
    const os = require('os');
    const path = require('path');
    let served = null; // what serves the settings in use: { key, children, live, forge, brain }
    // A part served, or why its settings do not hold.
    const part = (name) => {
        const value = served[name];
        if (value.problem) throw new Error(value.problem);
        return value;
    };
    // Methods that answer from whatever is served when they are called.
    const through = (read, names) =>
        Object.fromEntries(names.map((name) => [name, async (...args) => read()[name](...args)]));
    // The commands still running for settings no longer used end, those they would start after end at once, and what
    // they report is no longer sent.
    const retire = () => {
        if (!served) return;
        served.live.on = false;
        for (const child of served.children) child.kill();
        served = null;
    };

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
            const key = JSON.stringify([forgeAt, brainAt]);
            if (served && served.key === key) return;
            const first = !served;
            retire();
            const children = new Set();
            const live = { on: true };
            const track = (child) => {
                if (!live.on) return child.kill();
                children.add(child);
                child.once('close', () => children.delete(child));
            };
            const send = (name) => (state) => live.on && emit(name, state);
            const loginPath = require('./login-path.js')(track);
            const forgeFor = (at) => {
                const forge = require('./forge/supervisor.js')({ ...at, id, track, live: () => live.on, loginPath });
                return {
                    supervisor: forge.methods,
                    tasks: require('./forge/tasks.js')({ forge, send: send('tasks') }),
                    release: require('./forge/release.js')({ forge, send: send('release') }),
                };
            };
            served = {
                key,
                children,
                live,
                forge: forgeAt.problem ? forgeAt : forgeFor(forgeAt),
                brain: brainAt.problem ? brainAt : require('./llmemory/brain.js')({ ...brainAt, track, loginPath }),
            };
            // What other mods hear starts again with the new settings' reports.
            if (!first && !forgeAt.problem) {
                send('tasks')(served.forge.tasks.state());
                send('release')(served.forge.release.state());
            }
        },
        forge: {
            supervisor: through(
                () => part('forge').supervisor,
                ['call', 'runSchedule', 'sessions', 'session', 'start', 'stop', 'restart', 'log']
            ),
            tasks: through(() => part('forge').tasks, ['state', 'check', 'sync']),
            release: through(() => part('forge').release, ['state', 'check']),
        },
        brain: through(() => part('brain'), ['search', 'list', 'axes', 'get', 'related']),
        // The daemons it started are the person's and run on after the app; the commands it runs end with it.
        dispose: retire,
    };
};
