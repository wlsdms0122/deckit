const { face } = require('./face/face.js');

// The date and time in the status bar, the machine's, as the person's language writes them short.
class Clock {
    // The face, while it is attached.
    face = null;

    attach(shell, deckit) {
        this.face = face(shell, deckit);
    }

    detach() {
        this.face?.end();
        this.face = null;
    }
}

module.exports = Clock;
