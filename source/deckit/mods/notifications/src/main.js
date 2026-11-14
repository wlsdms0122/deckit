const { center, INTERFACE } = require('./center/center.js');
const { screen } = require('./screen/screen.js');

// The owner of deckit/notifications: `start` takes what mods post, keeps it and shows it, as the system's notifications
// with no screen; `attach` draws toasts and the list of recent notifications in a window of its own over the app, open
// while it shows any.
class Notifications {
    // What attach has put on screen for the commands to reach, while it is attached.
    screen = null;

    // A press runs the command a notification names through deckit/commands, while it is connected. The commands its
    // manifest declares run from the exports for its id: `show` opens the list on the screen attach made, and one run
    // while there is none says so.
    start(deckit) {
        let commands = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.center = center(deckit, { commands: () => commands });
        deckit.exports.register(INTERFACE, { connect: (connection) => this.center.exportsFor(connection) });
        const own = {
            show: () => {
                if (!this.screen) throw new Error('Notifications has no window to open');
                this.screen.showList();
            },
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

    attach(shell) {
        this.screen = screen(shell, this.center);
    }

    detach() {
        this.screen?.end();
        this.screen = null;
    }
}

module.exports = Notifications;
