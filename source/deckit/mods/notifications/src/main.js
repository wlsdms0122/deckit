const { center, INTERFACE } = require('./center/center.js');
const { screen } = require('./screen/screen.js');

// The owner of deckit/notifications: `start` takes what mods post, keeps it and shows it, as the system's notifications
// with no screen; `attach` draws toasts and the list of recent notifications in a window of its own over the app.
class Notifications {
    start(deckit) {
        this.center = center(deckit);
        deckit.exports.register(INTERFACE, { connect: (connection) => this.center.exportsFor(connection) });
    }

    attach(shell, deckit) {
        this.screen = screen(shell, this.center);
        deckit.commands.register({ show: { run: () => this.screen?.showList() } });
    }

    detach() {
        this.screen?.end();
        this.screen = null;
    }
}

module.exports = Notifications;
