// Connections in main (deckit-shell/deckit/connection/main.js) over a stand-in for the core, the runner and the
// catalog: a run that listens for a name launches nothing from here, as it launches or as a lifecycle joins: the core
// launches the mod a lifecycle waits for. Exits 1 with a line for each check that failed. The packages are ES modules,
// so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createConnection } = await import(url('deckit-shell', 'deckit', 'connection', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    IPC.carry(
        { messages: { listen: () => {}, tell: () => {} }, pages: { isGone: () => false, watch: () => {} } },
        {
            report: () => {},
        }
    );
    const observers = new Map();
    const launched = [];
    const RUNNER = {
        observe: (name, observer) => observers.set(name, observer),
        handleEffect: () => {},
        runOf: () => null,
        launch: async (id) => launched.push(id),
    };
    const CATALOG = { mods: () => [] };
    const LOG = { warn: () => {}, error: () => {} };
    const CONNECTION = createConnection({ CORE: { request: async () => [] }, LOG, IDENTITY: {}, CATALOG, RUNNER });
    CONNECTION.start();
    check(
        'a run that launches or a lifecycle that joins launches nothing from here',
        !observers.has('didLaunch') && !observers.has('didJoin') && !launched.length,
        { observed: [...observers.keys()], launched }
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} connection checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} connection checks`);
}

main().catch((error) => {
    console.error('[connection] ' + (error.stack || error.message));
    process.exit(1);
});
