const { packages, INTERFACE } = require('./packages/packages.js');

// The owner of deckit/packages: installs a mod from a folder once the mods its package file names as dependencies are
// installed at versions their requirements take. It has no view, and launches as a client connects to it.
class Packages {
    async start(deckit) {
        const file = await deckit.mainProcess('main-process/package/package.js');
        const service = packages(deckit, file);
        deckit.exports.register(INTERFACE, { connect: (connection) => service.exportsFor(connection) });
    }
}

module.exports = Packages;
