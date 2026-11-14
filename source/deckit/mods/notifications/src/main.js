const { center, INTERFACE } = require('./center/center.js');
const { screen } = require('./screen/screen.js');

const CENTER = 'notifications/center';

// The owner of deckit/notifications: `start` takes what mods post, keeps it and shows it, as the system's notifications
// with no screen; `attach` draws toasts in a window of its own over every app, open while it shows any, and the
// notification center, the list of recent notifications, in a panel window along the right edge of the app's desktop,
// which `notifications/center` opens and closes.
class Notifications {
    // What attach has put on screen for the commands to reach, while it is attached.
    screen = null;

    // A press runs the command a notification names through deckit/commands, while it is connected. The commands its
    // manifest declares run from the exports for its id: `show` opens the center on the screen attach made, and one
    // run while there is none says so.
    start(deckit) {
        let commands = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.center = center(deckit, { commands: () => commands });
        deckit.exports.register(INTERFACE, { connect: (connection) => this.center.exportsFor(connection) });
        const own = {
            show: () => this.onScreen().showList(),
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (!Object.hasOwn(own, id)) throw new Error(`Notifications has no command ${id}`);
                    await own[id]();
                },
            }),
        });
    }

    // `notifications/center` opens and closes the center, which only means something on screen; its signal
    // `notifications/center:changed` tells `{ open }` each time it opens or closes.
    attach(shell, deckit) {
        const changed = (open) => deckit.events.emit(`${CENTER}:changed`, { open });
        this.screen = screen(shell, this.center, { onCenter: changed });
        deckit.exports.register(CENTER, { connect: () => ({ toggle: () => this.onScreen().toggle() }) });
    }

    detach() {
        this.screen?.end();
        this.screen = null;
    }

    onScreen() {
        if (!this.screen) throw new Error('Notifications has no window to open');
        return this.screen;
    }
}

module.exports = Notifications;
