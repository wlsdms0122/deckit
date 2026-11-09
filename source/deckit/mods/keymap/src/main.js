const { keymap, INTERFACE } = require('./keymap/keymap.js');

// The owner of deckit/keys: binds the keys mods declare to it, takes their chords through the keys of the shell's
// handle from attach, and runs a key's command through deckit/commands as its chord is pressed. It has no view.
class Keymap {
    start(deckit) {
        this.keymap = keymap(deckit);
        deckit.exports.register(INTERFACE, { connect: (connection) => this.keymap.exportsFor(connection) });
    }

    attach(shell) {
        this.keymap.attach(shell.keys);
    }

    detach() {
        this.keymap.attach(null);
    }
}

module.exports = Keymap;
