// The bot's forge daemons and brain, for the folder the bot is in: `use(home)` names it, before anything is asked and
// again when the setting changes. `~` at its start is the home folder.
module.exports = ({ id, emit }) => {
    const os = require('os');
    const path = require('path');
    let served = null; // what serves the folder in use: { folder, children, live, forge, tasks, release, brain }
    let problem = "the bot's folder is not set";
    let used = false;
    const serving = () => {
        if (!served) throw new Error(problem);
        return served;
    };
    // Methods that answer from whatever folder is used when they are called.
    const through = (part, names) =>
        Object.fromEntries(names.map((name) => [name, async (...args) => part()[name](...args)]));
    // The commands still running for a folder no longer used end, those it would start after end at once, and what
    // they report is no longer sent.
    const retire = () => {
        if (!served) return;
        served.live.on = false;
        for (const child of served.children) child.kill();
        served = null;
    };

    return {
        use(home) {
            const given = String(home || '').replace(/^~(?=$|\/)/, os.homedir());
            const folder = path.isAbsolute(given) ? path.resolve(given) : null;
            if (served && served.folder === folder) return;
            const first = !used;
            used = true;
            retire();
            if (!folder) {
                problem = `the bot's folder is not a full path: ${home}`;
                return;
            }
            const children = new Set();
            const live = { on: true };
            const track = (child) => {
                if (!live.on) return child.kill();
                children.add(child);
                child.once('close', () => children.delete(child));
            };
            const send = (name) => (state) => live.on && emit(name, state);
            const forge = require('./forge/supervisor.js')({ home: folder, id, track, live: () => live.on });
            served = {
                folder,
                children,
                live,
                forge,
                tasks: require('./forge/tasks.js')({ forge, send: send('tasks') }),
                release: require('./forge/release.js')({ forge, send: send('release') }),
                brain: require('./llmemory/brain.js')({ home: folder, track }),
            };
            // What other mods hear starts again with the new folder's reports.
            if (!first) {
                send('tasks')(served.tasks.state());
                send('release')(served.release.state());
            }
        },
        forge: {
            supervisor: through(
                () => serving().forge.methods,
                ['call', 'runSchedule', 'sessions', 'session', 'start', 'stop', 'restart', 'log']
            ),
            tasks: through(() => serving().tasks, ['state', 'check', 'sync']),
            release: through(() => serving().release, ['state', 'check']),
        },
        brain: through(() => serving().brain, ['search', 'list', 'axes', 'get', 'related']),
        // The daemons it started are the person's and run on after the app; the commands it runs end with it.
        dispose: retire,
    };
};
