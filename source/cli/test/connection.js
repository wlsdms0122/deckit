// Connections in main (deckit-shell/deck/connection/main.js) over a stand-in for the core, the runner and the catalog:
// a run that listens for a name, as it launched or as a lifecycle joined, launches the mod it reaches by it when that
// mod is not running, by id or the owner of an interface, as the run's mod for the connection; a mod running, an
// interface the run's own mod owns and a name its manifest does not give launch nothing, and a launch that fails is
// logged with why. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as
// such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createConnection } = await import(url('deckit-shell', 'deck', 'connection', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
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
    const activated = [];
    const running = new Set(['d']);
    const RUNNER = {
        observe: (name, observer) => observers.set(name, observer),
        handleEffect: () => {},
        runOf: (id) => (running.has(id) ? { state: 'running' } : null),
        activate: async (id, origin) => {
            activated.push({ id, origin });
            if (id === 'e')
                throw Object.assign(new Error('e is not running: it did not launch'), { kind: 'NOT_RUNNING' });
            running.add(id);
            return { state: 'running' };
        },
    };
    const CATALOG = {
        mods: () => [],
        owners: () =>
            new Map([
                ['p/x', 'c'],
                ['p/own', 'a'],
            ]),
    };
    const warned = [];
    const LOG = { warn: (...line) => warned.push(line.map(String).join(' ')), error: () => {} };
    const CONNECTION = createConnection({ CORE: { request: async () => [] }, LOG, IDENTITY: {}, CATALOG, RUNNER });
    CONNECTION.start();

    // Mod a depends on b by id, optionally, and on d, which runs, and uses p/x, owned by c, and p/own, which it owns.
    const a = {
        id: 'a',
        manifest: {
            dependencies: { b: { optional: true }, d: { optional: true }, e: { optional: true } },
            uses: { 'p/x': '1', 'p/own': '1' },
        },
    };
    observers.get('didLaunch')({ mod: a, contributions: { awaits: { b: 0, d: 0, 'p/x': 1, 'p/own': 0, other: 0 } } });
    await tick();
    check(
        'a run that listens for names launches the mod by id and the owner of an interface that are not running',
        activated.map(({ id }) => id).join() === 'b,c',
        activated
    );
    check(
        "each launches for the connection's name, as the listening run's mod",
        activated.every(({ origin }) => origin.kind === 'work' && origin.mod === 'a') &&
            activated[0].origin.work.connection === 'b' &&
            activated[1].origin.work.connection === 'p/x',
        activated
    );

    activated.length = 0;
    observers.get('didJoin')({ mod: a, contributions: { awaits: { b: 1, e: 1 } } });
    await tick();
    await tick();
    check(
        'a lifecycle that joins listening launches what is not running, and a launch that fails is logged with why',
        activated.map(({ id }) => id).join() === 'e' && warned.some((line) => /did not launch/.test(line)),
        { activated, warned }
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
