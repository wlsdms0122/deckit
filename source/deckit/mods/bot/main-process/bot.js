// The bot's forge daemons and brain, for the folder the bot is in: `use(home)` names it, before anything is asked and
// again when the setting changes. `~` at its start is the home folder.
module.exports = ({ id, emit }) => {
    const os = require('os');
    let served = null;
    const serving = () => {
        if (!served) throw new Error("the bot's folder is not set");
        return served;
    };
    // Methods that answer from whatever folder is used when they are called.
    const through = (part, names) =>
        Object.fromEntries(names.map((name) => [name, (...args) => part()[name](...args)]));

    return {
        use(home) {
            const folder = String(home || '').replace(/^~(?=$|\/)/, os.homedir());
            const forge = require('./forge/supervisor.js')({ home: folder, id });
            served = {
                forge,
                tasks: require('./forge/tasks.js')({ forge, send: (state) => emit('tasks', state) }),
                release: require('./forge/release.js')({ forge, send: (state) => emit('release', state) }),
                brain: require('./llmemory/brain.js')({ home: folder }),
            };
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
        // It holds nothing that outlives a call: the daemons it starts are the person's and run on after the app.
        dispose() {},
    };
};
