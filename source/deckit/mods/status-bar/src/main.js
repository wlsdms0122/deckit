const { bar } = require('./bar/bar.js');
const { items, INTERFACE } = require('./bar/items.js');

// The status bar: a capsule at the top right of the app, a panel window of its own, holding the items mods give it
// through `status-bar/items`. It is the frame; what stands under an item is its mod's own view.
class StatusBar {
    // The items as they stand, while the mod runs.
    items = null;
    // The capsule, while it is attached.
    bar = null;

    // The items are held from the start, on screen or not, so a mod gives its item from any lifecycle of its own.
    start(deckit) {
        this.items = items(deckit);
        deckit.exports.register(INTERFACE, {
            connect: (connection) => this.items.exportsFor(connection),
            disconnect: (connection) => this.items?.leave(connection.credential.mod),
        });
    }

    // The capsule draws what stands. A press on an item runs its command through deckit/commands, while it is
    // connected.
    attach(shell, deckit) {
        let commands = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.bar = bar(shell, this.items, { commands: () => commands });
    }

    detach() {
        this.bar?.end();
        this.bar = null;
    }

    stop() {
        this.items?.end();
        this.items = null;
    }
}

module.exports = StatusBar;
