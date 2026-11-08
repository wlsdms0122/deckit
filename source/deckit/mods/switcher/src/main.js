const { switcher } = require('./switcher/switcher.js');

// The quick switcher: each mod to show and the actions mods set through its exports, `setActions(actions)`, in a
// window of its own over whichever app is in front, opened from any of them by its key. The window is the list, which
// the kit's quick pick draws over the page.
class Switcher {
    // The list in its window, which attach makes, for the commands to reach while it is attached.
    list = null;

    // The commands its manifest declares to `deckit/commands`, run from the exports for its id. `show` opens the list
    // attach made, and one run while there is none says so.
    start(deckit) {
        const commands = {
            show: () => {
                if (!this.list) throw new Error('Switcher has no window to open');
                return this.list.show();
            },
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Switcher has no command ${id}`);
                    await commands[id]();
                },
            }),
        });
    }

    attach(shell, deckit) {
        const window = shell.window.register({
            content: document.createElement('div'),
            width: 600,
            height: 400,
            overlay: true,
            didDisappear: () => this.list?.closed(),
            didResignKey: () => this.list?.putAway(),
        });
        const given = new Map(); // connection -> the actions its mod set
        // The owners of deckit/notifications and deckit/commands, each while one is connected.
        let notifications = null;
        let commands = null;
        deckit.dependencies.onConnect('deckit/notifications', (connected) => {
            notifications = connected;
            return () => (notifications = null);
        });
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.list = switcher(shell, deckit, window, given, {
            notifications: () => notifications,
            commands: () => commands,
        });
        deckit.exports.register('switcher/actions', {
            connect: (connection) => ({
                setActions: (actions) => {
                    given.set(connection, actions);
                },
            }),
            disconnect: (connection) => given.delete(connection),
        });
    }

    detach() {
        this.list?.end();
        this.list = null;
    }
}

module.exports = Switcher;
