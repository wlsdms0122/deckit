const { center, INTERFACE } = require('./center/center.js');
const { item } = require('./item/item.js');
const { screen } = require('./screen/screen.js');

// The owner of deckit/notifications: `start` takes what mods post, keeps it and shows it, as the system's notifications
// with no screen, and keeps the mod's item in the status bar; `attach` draws the toasts in a view at the top right of
// the stage, open while it holds any, and the notification center, the list of recent notifications, in a view under
// the item.
class Notifications {
    // The item's holder, while the mod runs.
    item = null;
    // What attach has put on screen for the commands to reach, while it is attached.
    screen = null;

    // A press runs the command a notification names through deckit/commands, while it is connected. The commands its
    // manifest declares run from the exports for its id: `toggle`, the item's, shows the center or puts it away and
    // `show` shows it, on the screen attach made, and one run while there is none says so.
    start(deckit) {
        let commands = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.center = center(deckit, { commands: () => commands });
        this.item = item(deckit, this.center);
        deckit.exports.register(INTERFACE, { connect: (connection) => this.center.exportsFor(connection) });
        const own = {
            show: () => this.onScreen().showList(),
            toggle: () => this.onScreen().toggle(),
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

    stop() {
        this.item?.end();
        this.item = null;
    }

    onScreen() {
        if (!this.screen) throw new Error('Notifications has no window to open');
        return this.screen;
    }
}

module.exports = Notifications;
