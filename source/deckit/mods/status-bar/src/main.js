const { bar, INTERFACE } = require('./bar/bar.js');

// The status bar: a capsule at the top right of the app, a panel window of its own, showing in a row the view of each
// mod that names `status-bar/items` as its view's parent. It is the place; the mods that join it give what it shows.
class StatusBar {
    // The capsule, while it is attached.
    bar = null;

    // Each item's mod tells its width on the exports of `status-bar/items`, which mean something only on screen.
    attach(shell, deckit) {
        this.bar = bar(shell);
        deckit.exports.register(INTERFACE, {
            connect: (connection) => ({
                setWidth: async (width) => this.bar?.setWidth(connection.credential.mod, width),
            }),
        });
    }

    detach() {
        this.bar?.end();
        this.bar = null;
    }
}

module.exports = StatusBar;
