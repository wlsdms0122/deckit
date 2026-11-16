const { face } = require('./face/face.js');

// The date and time in the status bar, the machine's, as the person's language writes them short. It runs from the
// start; its item says the time and a press on it does nothing.
class Clock {
    // The item's label, while the mod runs.
    face = null;

    start(deckit) {
        this.face = face(deckit);
    }

    stop() {
        this.face?.end();
        this.face = null;
    }
}

module.exports = Clock;
