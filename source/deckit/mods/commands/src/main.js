const { registry, INTERFACE } = require('./registry/registry.js');

// The owner of deckit/commands: lists the commands mods declare to it and runs one on the exports its mod opens for its
// id, for a client that holds deckit.system-services. It has no view, and launches as a client connects to it.
class Commands {
    start(deckit) {
        const commands = registry(deckit);
        deckit.exports.register(INTERFACE, { connect: (connection) => commands.exportsFor(connection) });
    }
}

module.exports = Commands;
