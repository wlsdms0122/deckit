const { switcher } = require('./switcher/switcher.js');

// The quick switcher: each mod to show and the actions mods set through its exports, `setActions(actions)`, in a
// window of its own over whichever app is in front, opened from any of them by its key. The window is the list, which
// the kit's quick pick draws over the page.
class Switcher {
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
        this.list = switcher(shell, deckit, window, given);
        deckit.exports.register('switcher/actions', {
            connect: (connection) => ({
                setActions: (actions) => {
                    given.set(connection, actions);
                },
            }),
            disconnect: (connection) => given.delete(connection),
        });
        deckit.commands.register({
            show: { run: () => this.list?.show() },
        });
        deckit.keys.register({ summon: { run: () => this.list?.toggle() } });
    }

    detach() {
        this.list?.end();
        this.list = null;
    }
}

module.exports = Switcher;
