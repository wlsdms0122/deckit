const { router, INTERFACE } = require('./router/router.js');

// The owner of deckit/urls: opens an address with the mod that opens it, reached by its id, or outside the app when
// none takes it, and keeps the choice for each scheme. It has no view, and launches as a client connects to it.
class URLs {
    start(deckit) {
        const urls = router(deckit);
        deckit.exports.register(INTERFACE, { connect: (connection) => urls.exportsFor(connection) });
    }
}

module.exports = URLs;
