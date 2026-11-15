const { bar, INTERFACE } = require('./bar/bar.js');

// The status bar: a capsule at the top right of the app, a panel window of its own, holding the items mods give it
// through `status-bar/items`. It is the frame; what stands under an item is its mod's own view.
class StatusBar {
    // The capsule, while it is attached.
    bar = null;

    // A press on an item runs its command through deckit/commands, while it is connected. The exports of
    // `status-bar/items` mean something only on screen.
    attach(shell, deckit) {
        let commands = null;
        deckit.dependencies.onConnect('deckit/commands', (connected) => {
            commands = connected;
            return () => (commands = null);
        });
        this.bar = bar(shell, deckit, { commands: () => commands });
        deckit.exports.register(INTERFACE, {
            connect: (connection) => this.bar?.exportsFor(connection),
            disconnect: (connection) => this.bar?.leave(connection.credential.mod),
        });
    }

    detach() {
        this.bar?.end();
        this.bar = null;
    }
}

module.exports = StatusBar;
