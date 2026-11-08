const { configuration, INTERFACE } = require('./configuration/configuration.js');

// The owner of deckit/configuration: the settings mods declare to it, each read and set by its own mod and by a client
// that holds deckit.system-services, and kept across runs. It has no view, and launches as a client connects to it.
class Configuration {
    start(deckit) {
        const settings = configuration(deckit);
        deckit.exports.register(INTERFACE, {
            connect: (connection) => settings.exportsFor(connection),
            disconnect: (connection) => settings.forget(connection),
        });
    }
}

module.exports = Configuration;
