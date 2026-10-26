// The forge daemons, where the mod's settings say forge is: `use(settings)` gives them, before anything is asked and
// again when one changes. A command left empty is the one on the login shell's PATH, and `~` at the start of a path is
// the home folder. Each change of a run dispatched from here is sent as `run`.
module.exports = ({ emit }) => {
    const os = require('os');
    const path = require('path');
    const commands = require('./command.js')();
    // Runs outlive the settings they were dispatched with: one cut off by a change is told as ended.
    const runs = require('./runs.js')({ changed: (run) => emit('run', run) });
    // What is served for the settings in use, `{ key, children, live, methods, problem }`: when they change, the
    // commands it still runs end and those it would start after end at once.
    let served = null;

    const retire = () => {
        if (!served) return;
        served.live.on = false;
        for (const child of served.children) child.kill();
        served = null;
    };

    const serve = (at) => {
        const children = new Set();
        const live = { on: true };
        const track = (child) => {
            if (!live.on) return child.kill();
            children.add(child);
            child.once('close', () => children.delete(child));
        };
        // Settings that do not hold stand for the daemons: every method tells the problem.
        const methods = at.problem
            ? null
            : require('./supervisor.js')({ ...at, track, live: () => live.on, commands, runs }).methods;
        return { children, live, methods, problem: at.problem || null };
    };

    const expand = (value) =>
        String(value ?? '')
            .trim()
            .replace(/^~(?=$|\/)/, os.homedir());
    // A command: a name looked up on the PATH, or a full path.
    const commandOf = (value) => {
        const given = expand(value) || 'forge';
        if (!given.includes('/')) return given;
        if (!path.isAbsolute(given)) throw new Error(`the forge command is not a name or a full path: ${value}`);
        return path.resolve(given);
    };
    const fileOf = (value) => {
        const given = expand(value);
        if (given && !path.isAbsolute(given)) throw new Error(`forge's configuration is not a full path: ${value}`);
        return given ? path.resolve(given) : null;
    };
    const where = (settings) => {
        try {
            return { command: commandOf(settings.forge), config: fileOf(settings.forgeConfig) };
        } catch (error) {
            return { problem: error.message };
        }
    };

    const methods = () => {
        if (!served) throw new Error('Forge is not serving: the mod has not started or has stopped');
        if (served.problem) throw new Error(served.problem);
        return served.methods;
    };
    const through = (names) =>
        Object.fromEntries(names.map((name) => [name, async (...args) => methods()[name](...args)]));

    return {
        use(settings) {
            const at = where(settings);
            const key = JSON.stringify(at);
            if (served && served.key === key) return;
            retire();
            served = { key, ...serve(at) };
        },
        ...through(['call', 'runSchedule', 'sessions', 'session', 'start', 'stop', 'restart', 'log']),
        run: async (id) => runs.get(id),
        // The daemons it started are the person's and run on after the app; the commands it runs end with it.
        dispose: () => {
            retire();
            commands.end();
        },
    };
};
