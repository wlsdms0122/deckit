// The bot's brain, where its configuration says it is: `use(configuration)` gives it, before anything is asked and
// again when it changes, and answers whether it is served anew. A command left empty is the one on the login shell's
// PATH, and `~` at the start of a path is the home folder.
module.exports = () => {
    const os = require('os');
    const path = require('path');
    const commands = require('../command/command.js')();
    // What is served for the configuration in use, `{ key, children, live, brain, problem }`: when it changes, the
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
        // A configuration that does not hold stands for the brain: every method tells the problem.
        const brain = at.problem ? null : require('../llmemory/brain.js')({ ...at, track, commands });
        return { children, live, brain, problem: at.problem || null };
    };

    const expand = (value) =>
        String(value ?? '')
            .trim()
            .replace(/^~(?=$|\/)/, os.homedir());
    // A command: a name looked up on the PATH, or a full path.
    const commandOf = (value) => {
        const given = expand(value) || 'llmemory';
        if (!given.includes('/')) return given;
        if (!path.isAbsolute(given)) throw new Error(`the llmemory command is not a name or a full path: ${value}`);
        return path.resolve(given);
    };
    const where = (configuration) => {
        try {
            const home = expand(configuration.brain);
            if (!home) throw new Error("the brain's folder is not set: give it in Settings");
            if (!path.isAbsolute(home))
                throw new Error(`the brain's folder is not a full path: ${configuration.brain}`);
            return { command: commandOf(configuration.llmemory), home: path.resolve(home) };
        } catch (error) {
            return { problem: error.message };
        }
    };

    const brain = () => {
        if (!served) throw new Error('Bot is not serving the brain: the mod has not started or has stopped');
        if (served.problem) throw new Error(served.problem);
        return served.brain;
    };

    return {
        use(configuration) {
            const at = where(configuration);
            const key = JSON.stringify(at);
            if (served && served.key === key) return false;
            retire();
            served = { key, ...serve(at) };
            return true;
        },
        brain: Object.fromEntries(
            ['search', 'list', 'axes', 'get', 'related'].map((name) => [
                name,
                async (...args) => brain()[name](...args),
            ])
        ),
        // The commands it runs end with it.
        dispose: () => {
            retire();
            commands.end();
        },
    };
};
