const { face } = require('./face/face.js');

const COMMAND = 'toggle-center';

// The date and time in the status bar, the machine's, as the person's language writes them short. It runs from the
// start, and its item's command, run from the exports for its id, opens and closes the notification center.
class Clock {
    // The item's label and what its command does, while the mod runs.
    face = null;

    start(deckit) {
        this.face = face(deckit);
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id) => {
                    if (id !== COMMAND) throw new Error(`Clock has no command ${id}`);
                    await this.face.toggleCenter();
                },
            }),
        });
    }

    stop() {
        this.face?.end();
        this.face = null;
    }
}

module.exports = Clock;
