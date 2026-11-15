// The wire a party from outside speaks (deckit-shell/deckit/outside) over stand-ins for the transport, the core, the
// runner and the seats: what a party asks is held to its method's fields before a channel carries it, what is only told
// main as what main answers, refused as a bad argument under the method's name, and what is well formed reaches what
// answers or hears it. Exits 1 with a line for each check that failed.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const { createOutside } = await import(url('deckit-shell', 'deckit', 'outside', 'main.js'));
    const { createRecord } = await import(url('deckit-shell', 'deckit', 'record', 'main.js'));
    const { createEvent } = await import(url('deckit-shell', 'deckit', 'event', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const user = { id: 'ada', granted: ['deckit.seat'] };
    IPC.carry(
        { messages: { listen() {}, tell() {} }, pages: { isGone: () => false, watch() {} } },
        { report: () => {}, identify: () => user }
    );
    const listened = []; // what the core was asked to listen to
    const CORE = {
        timeout: () => ({ end: 5000 }),
        request: async (method, params) => {
            if (method === 'event/listen') listened.push(params);
            return method === 'authentication/challenge' ? { challenge: 'c', schemes: [] } : null;
        },
    };
    const IDENTITY = { modFrom: () => user };
    const RUNNER = { offer: () => () => {}, runOf: () => ({ number: 1 }), handleEffect() {} };
    createRecord({ CORE, IDENTITY }).start();
    createEvent({ CORE, LOG: { error() {} }, IDENTITY, RUNNER }).start();
    const SEAT = {
        admit: async ({ transport }) => ({
            effects: [{ effect: 'open', transport, mod: user.id, permissions: user.granted }],
            seat: { id: 's1', user: { id: user.id, name: 'Ada' }, local: false },
        }),
    };
    let opened = null;
    const transport = { listen: (where, listeners) => (opened = listeners.opened) };
    createOutside({ CORE, LOG: { error() {} }, RUNNER, SEAT, transport, path: 'nowhere' }).start();

    // A party: what it asks, answered by the message of its id.
    const waiting = new Map();
    let asked = 0;
    const party = opened({
        send: (line) => {
            const { id, result, error } = JSON.parse(line);
            waiting.get(id)?.({ result, error });
        },
        close() {},
        limit() {},
    });
    const ask = (method, params) =>
        new Promise((resolve) => {
            waiting.set(++asked, resolve);
            party.onMessage(JSON.stringify({ jsonrpc: '2.0', id: asked, method, params }));
        });
    await ask('initialize', { protocol: 1, nonce: 'n' });
    await ask('authenticate', { principal: user.id, scheme: 'ed25519', key: 'k', signature: 's' });

    const malformed = [
        ['seat/read', {}, 'seat/read needs of'],
        ['seat/input', { event: 'key' }, 'seat/input needs type'],
        ['seat/watch', { of: 'changes' }, 'seat/watch needs on'],
        ['seat/watch', { of: 'changes', on: 1 }, "seat/watch's on is number, not boolean"],
        ['record/read', {}, 'record/read needs key'],
        ['record/read', { key: 5 }, "record/read's key is number, not string"],
        ['record/keys', { other: 1 }, 'record/keys has no field other'],
        ['connection/reach', { lifecycle: 0 }, 'connection/reach needs target'],
        ['runner/started', {}, 'runner/started needs contributions'],
        ['runner/problem', { problem: 5 }, "runner/problem's problem is number, not string"],
        ['connection/end', { lifecycle: 0, other: 1 }, 'connection/end has no field other'],
        ['connection/let-go', { connection: 1, number: 0 }, 'connection/let-go needs count'],
        ['event/listen', { names: 'ada:ping' }, "event/listen's names is string, not array"],
        ['event/emit', { name: 'ping' }, 'event/emit needs args'],
        ['connection/end', { lifecycle: 0, run: 1 }, 'connection/end has no field run'],
        ['runner/started', { contributions: {}, summary: {} }, 'runner/started has no field summary'],
        ['record/keys', 'all', 'record/keys carries an object, not string'],
        ['runner/quit', [], 'runner/quit carries an object, not array'],
        ['record/keys', null, 'record/keys carries an object, not null'],
    ];
    for (const [method, params, message] of malformed) {
        const { error } = await ask(method, params);
        check(
            `a ${method} that is not its method's fields is a bad argument, said under the method's name`,
            error?.data?.kind === 'INVALID_ARGUMENT' && error.data.stage === 'call' && error.message === message,
            { params, error }
        );
    }
    const keys = await ask('record/keys');
    check('params left out are an empty object', !keys.error, keys);
    const read = await ask('record/read', { key: 'note' });
    check('what is well formed reaches what answers it', read.result === null && !read.error, read);
    const told = await ask('event/listen', { names: ['ada:ping'] });
    check(
        'what is well formed and only told is answered true, and reaches what hears it',
        told.result === true &&
            !told.error &&
            JSON.stringify(listened) === '[{"mod":"ada","run":1,"names":["ada:ping"]}]',
        { told, listened }
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} outside wire checks`);
}

main().catch((error) => {
    console.error('[test] ' + error.stack);
    process.exit(1);
});
