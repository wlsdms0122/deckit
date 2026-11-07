const { keymap, INTERFACE } = require('./keymap/keymap.js');

// The owner of deckit/keys: binds the keys mods declare to it, takes their chords from the start through the keys hole,
// and runs a key's command through deckit/commands as its chord is pressed. It has no view.
class Keymap {
    start(deckit) {
        const keys = keymap(deckit);
        deckit.exports.register(INTERFACE, { connect: (connection) => keys.exportsFor(connection) });
    }
}

module.exports = Keymap;
