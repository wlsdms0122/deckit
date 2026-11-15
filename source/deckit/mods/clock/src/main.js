const { face } = require('./face/face.js');

const COMMAND = 'toggle-center';
const CENTER = 'notifications/center';

// The date and time in the status bar, the machine's, as the person's language writes them short. It runs from the
// start, and its item's command, run from the exports for its id, opens and closes the notification center.
class Clock {
    // The item's label, while the mod runs.
    face = null;
    // The notification center's exports, while it is connected.
    center = null;

    start(deckit) {
        this.face = face(deckit);
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (id !== COMMAND) throw new Error(`Clock has no command ${id}`);
                    if (!this.center) throw new Error('no mod shows a notification center now');
                    await this.center.toggle();
                },
            }),
        });
    }

    // The notification center is on screen only, so its exports are reached from here.
    attach(shell, deckit) {
        deckit.dependencies.onConnect(CENTER, (connected) => {
            this.center = connected;
            return () => (this.center = null);
        });
    }

    stop() {
        this.face?.end();
        this.face = null;
    }
}

module.exports = Clock;
