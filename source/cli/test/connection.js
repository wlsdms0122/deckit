// Connections in main (deckit-shell/deckit/connection/main.js) over a stand-in for the core, the runner and the
// catalog: a run that listens for a name launches nothing from here, as it launches or as a lifecycle joins: the core
// launches the mod a lifecycle waits for; a page's reach of a mod by its id and its release asked of the core for the
// page's mod, through the runner, which does what the core answers, and the core's refusal handed back; and a
// connection's end told to the pages of its client and its service, as the core names them. Exits 1 with a line for
// each check that failed. The packages are ES modules, so they are imported as such.
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

    let heard = null;
    IPC.carry(
        {
            messages: {
                listen: (listeners) => (heard = listeners),
                tell: (page, message) => tells.push([page, message]),
            },
            pages: { isGone: () => false, watch: () => {} },
        },
        {
            report: () => {},
        }
    );
    const tells = [];
    const observers = new Map();
    const effects = new Map();
    const launched = [];
    const ran = []; // what the runner asked of the core
    const RUNNER = {
        observe: (name, observer) => observers.set(name, observer),
        handleEffect: (name, handler) => effects.set(name, handler),
        runOf: () => null,
        launch: async (id) => launched.push(id),
        ask: async (method, params) => {
            ran.push([method, params]);
            if (params.target === 'x') throw Object.assign(new Error('x is out of reach of a'), { kind: 'REFUSED' });
            return [];
        },
    };
    const CATALOG = { mods: () => [] };
    const LOG = { warn: () => {}, error: () => {} };
    const IDENTITY = { pageOf: (id) => ({ modId: id }), modFrom: (page) => ({ id: page.modId }) };
    const CONNECTION = createConnection({ CORE: { request: async () => [] }, LOG, IDENTITY, CATALOG, RUNNER });
    CONNECTION.start();
    check(
        'a run that launches or a lifecycle that joins launches nothing from here',
        !observers.has('didLaunch') && !observers.has('didJoin') && !launched.length,
        { observed: [...observers.keys()], launched }
    );

    // A page of mod a reaches b by its id, then x, which the core refuses, and lets b go.
    const pageA = { modId: 'a' };
    const ask = (channel, payload) => heard.asked(pageA, { channel: `deckit-shell:${channel}`, payload });
    const reached = await ask('connection-reach', { run: 1, lifecycle: 0, target: 'b' });
    check(
        "a reach by id is asked of the core through the runner, for the page's mod",
        !reached.error &&
            JSON.stringify(ran[0]) === '["connection/reach",{"mod":"a","run":1,"lifecycle":0,"target":"b"}]',
        { reached, ran }
    );
    const refused = await ask('connection-reach', { run: 1, lifecycle: 0, target: 'x' });
    check('a reach the core refuses is answered with its kind', refused.error?.kind === 'REFUSED', refused);
    const released = await ask('connection-release-reach', { run: 1, lifecycle: 0, target: 'b' });
    check(
        'a release is asked of the core through the runner',
        !released.error &&
            JSON.stringify(ran.at(-1)) === '["connection/release",{"mod":"a","run":1,"lifecycle":0,"target":"b"}]',
        { released, ran }
    );

    effects.get('disconnect')({
        connection: {
            id: 7,
            name: 'p/x',
            client: { mod: 'a', run: 1, lifecycle: 0 },
            service: { mod: 'b', run: 1, lifecycle: 0 },
        },
    });
    const ends = tells.map(([page, message]) => `${page.modId} ${message.channel} ${message.payload?.id}`);
    check(
        "a connection's end is told to the pages of its client and its service",
        ends.join(' | ') === 'a deckit-shell:connection-disconnected 7 | b deckit-shell:connection-disconnected 7',
        ends
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
