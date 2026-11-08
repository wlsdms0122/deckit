// Connections in main (deckit-shell/deckit/connection/main.js) over a stand-in for the core, the runner and the
// catalog: a run that listens for a name launches nothing from here, as it launches or as a lifecycle joins: the core
// launches the mod a lifecycle waits for; a page's reach of a mod by its id and its release asked of the core for the
// page's mod, through the runner, which does what the core answers, and the core's refusal handed back; a connection
// that stands asked of its service's page with the client's credential, and one its service refuses told its client as
// a refusal at call; a reach and a call told as requests of one mod of another; a lifecycle that waits for a mod the
// core does not launch told so, with the refusal, on its page, as is one the core refuses what it reaches; and a
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
    const requests = []; // `from>to`, each request told
    const REQUEST = { tell: (from, to) => requests.push(`${from}>${to}`) };
    const CONNECTION = createConnection({
        CORE: { request: async (method) => (method === 'connection/route' ? { mod: 'b' } : []) },
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        REQUEST,
    });
    CONNECTION.start();
    check('a run that launches launches nothing from here', !observers.has('didLaunch') && !launched.length, {
        observed: [...observers.keys()],
        launched,
    });

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
    check('each reach is told as a request of the mod reached', requests.join() === 'a>b,a>x', requests);
    const released = await ask('connection-release-reach', { run: 1, lifecycle: 0, target: 'b' });
    check(
        'a release is asked of the core through the runner',
        !released.error &&
            JSON.stringify(ran.at(-1)) === '["connection/release",{"mod":"a","run":1,"lifecycle":0,"target":"b"}]',
        { released, ran }
    );

    // A connection that stands: its service's page is asked for the exports, handed the client's credential.
    const connected = effects.get('connect')({
        connection: {
            id: 6,
            name: 'p/x',
            client: { mod: 'a', run: 1, lifecycle: 0 },
            service: { mod: 'b', run: 1, lifecycle: 0 },
            credential: { mod: 'a', permissions: ['p/read'] },
        },
    });
    await tick();
    const [servicePage, question] = tells.find(([, message]) => message.channel === 'deckit-shell:connection-connect');
    check(
        "the service's page is asked for the exports with the client's credential",
        servicePage.modId === 'b' &&
            JSON.stringify(question.payload) ===
                '{"id":6,"name":"p/x","mod":{"id":"a","name":"a"},"lifecycle":0,' +
                    '"credential":{"mod":"a","permissions":["p/read"]}}',
        question
    );
    heard.told(servicePage, { channel: question.channel, id: question.id, value: { value: {}, references: [] } });
    await connected;
    tells.length = 0;

    // A connection its service refuses: the client is told the refusal, of the kind the service threw.
    const refusedConnection = effects.get('connect')({
        connection: {
            id: 8,
            name: 'p/x',
            client: { mod: 'a', run: 1, lifecycle: 0 },
            service: { mod: 'b', run: 1, lifecycle: 0 },
            credential: { mod: 'a', permissions: [] },
        },
    });
    await tick();
    const [refuser, refusedQuestion] = tells.find(
        ([, message]) => message.channel === 'deckit-shell:connection-connect'
    );
    heard.told(refuser, {
        channel: refusedQuestion.channel,
        id: refusedQuestion.id,
        error: { message: 'no connections here', kind: null },
    });
    await refusedConnection;
    const told = tells.find(([, message]) => message.channel === 'deckit-shell:connection-connected');
    check(
        'a connection its service refuses is told its client as a refusal at call',
        told?.[0].modId === 'a' &&
            JSON.stringify(told[1].payload) ===
                '{"id":8,"name":"p/x","refusal":{"stage":"call","kind":"REFUSED",' +
                    '"message":"p/x did not connect: no connections here"},"lifecycle":0}',
        told
    );
    tells.length = 0;

    // A call on a connection goes to the other end the core routes it to, told as a request of that mod.
    requests.length = 0;
    const calling = ask('connection-call', { run: 1, connection: 6, number: 1, args: { value: [], references: [] } });
    await tick();
    const [callee, call] = tells.find(([, message]) => message.channel === 'deckit-shell:connection-called') ?? [];
    check('a call is told as a request of the mod it goes to', callee?.modId === 'b' && requests.join() === 'a>b', {
        requests,
        callee,
    });
    if (call) heard.told(callee, { channel: call.channel, id: call.id, value: { value: null, references: [] } });
    await calling;
    tells.length = 0;

    // A lifecycle that waits: told on its page where the core does not launch the mod, and nothing where it does.
    const refusal = { stage: 'launch', kind: 'NOT_INSTALLED', message: 'no mod is listed under d' };
    effects.get('wait')({ effect: 'wait', mod: 'd', name: 'd', client: { mod: 'c', run: 1, lifecycle: 2 }, refusal });
    effects.get('wait')({ effect: 'wait', mod: 'e', name: 'e', client: { mod: 'c', run: 1, lifecycle: 2 } });
    const waits = tells.map(([page, message]) => [page.modId, message.channel, message.payload]);
    check(
        'a lifecycle that waits for a mod the core does not launch is told the refusal on its page, and no other',
        JSON.stringify(waits) ===
            JSON.stringify([['c', 'deckit-shell:connection-unreached', { lifecycle: 2, name: 'd', refusal }]]),
        waits
    );
    tells.length = 0;

    // A lifecycle the core refuses what it reaches: told on its page, with the refusal at call.
    const notExported = {
        stage: 'call',
        kind: 'NOT_EXPORTED',
        message: 'f runs with no exports for f that reach the lifecycle',
    };
    effects.get('refuse')({
        effect: 'refuse',
        name: 'f',
        client: { mod: 'c', run: 1, lifecycle: 0 },
        refusal: notExported,
    });
    const refuses = tells.map(([page, message]) => [page.modId, message.channel, message.payload]);
    check(
        'a lifecycle the core refuses what it reaches is told the refusal on its page',
        JSON.stringify(refuses) ===
            JSON.stringify([
                ['c', 'deckit-shell:connection-unreached', { lifecycle: 0, name: 'f', refusal: notExported }],
            ]),
        refuses
    );
    tells.length = 0;

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
