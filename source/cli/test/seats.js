// The seats on deckit's main side (deckit-shell/deckit/seat) over stand-ins for the core, the runner and the senders:
// the local user kept and seated as it starts, a user seated at once or after what is served answered the ask, a seat
// closed with its run, each method of a seat held to the seat permission and to a seat, and handed to what is served
// with the sender's seat. Exits 1 with a line for each check that failed.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const { createSeat, OUTSIDE } = await import(url('deckit-shell', 'deckit', 'seat', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The senders: each a transport connection, known by the mod it runs as, with what it was told.
    const identities = new Map();
    const told = new Map();
    const sender = (id, granted) => {
        const one = { id };
        identities.set(one, { id, granted });
        told.set(id, []);
        const carried = IPC.carryOutside(one, {
            tell: (message) => told.get(id).push(message),
            isGone: () => false,
            whenEnds: () => {},
        });
        const ask = (method, payload = {}) =>
            carried.asked({ channel: OUTSIDE.asked[method].channel.channel, payload });
        return { one, ask };
    };
    IPC.carry(
        { messages: { listen() {}, tell() {} }, pages: { isGone: () => false, watch() {} } },
        { report: () => {}, identify: (page) => identities.get(page) ?? null }
    );

    // The core: the users it keeps, and an admission that waits unless the local seat was idle for 300 s.
    const users = [];
    const asked = [];
    const outside = new Set();
    const seatOf = (id, name) => ({ id, user: { id: name, name: name.toUpperCase() }, local: id === 'local' });
    const CORE = {
        seatIdleTime: () => 300000,
        request: async (method, params) => {
            asked.push([method, params]);
            if (method === 'user/list') return users;
            if (method === 'user/add') return (users.push(params), true);
            if (method === 'seat/open-local') return seatOf('local', params.id);
            throw new Error(method);
        },
    };
    const RUNNER = {
        onOutside: (listener) => outside.add(listener),
        ask: async (method, params) => {
            asked.push([method, params]);
            if (method === 'authentication/verify')
                return params.idle >= 300
                    ? { effects: [], seat: seatOf('s9', params.principal) }
                    : { asking: { user: params.principal } };
            if (!params.allow) throw Object.assign(new Error('refused'), { kind: 'REFUSED', stage: 'call' });
            return { effects: [], seat: seatOf('s1', 'guest') };
        },
    };
    const IDENTITY = {
        modFrom: (page) => identities.get(page),
        pageOf: (id) => [...identities].find(([, mod]) => mod.id === id)?.[0] ?? null,
    };
    const SEAT = createSeat({ CORE, LOG: { error() {} }, IDENTITY, RUNNER, name: 'Host' });
    const opened = [];
    const closed = [];
    SEAT.onOpen((seat) => opened.push(seat.id));
    SEAT.onClose((seat) => closed.push(seat.id));
    await SEAT.start();
    check(
        'the local user is kept under the name of the host and sits at the local seat',
        users[0]?.id === 'local' && users[0].name === 'Host' && SEAT.local()?.local && SEAT.list().length === 1,
        [users, SEAT.list()]
    );
    check('a seat that just opened is not idle', SEAT.isIdle(SEAT.local()) === false, '');

    const hooks = { asking: () => hooks.told++, whenEnds: () => {}, told: 0 };
    const proof = { transport: 't1', principal: 'guest' };
    const unserved = await SEAT.admit(proof, hooks).catch((error) => error);
    check(
        'with nothing served, an admission that waits is told so and answered no',
        unserved.kind === 'REFUSED' && hooks.told === 1 && asked.at(-1)[1].allow === false && asked.at(-2)[1].idle < 1,
        [unserved.message, asked.slice(-2)]
    );
    const guest = sender('guest', ['deckit.seat']);
    const mod = sender('a-mod', ['deckit.mods']);
    const pointer = { type: 'down', x: 4, y: 8 };
    const seatless = await guest.ask('seat/pointer', pointer);
    const unpermitted = await mod.ask('seat/read', {});
    check(
        'a sender without the seat permission, and one with it at no seat, are refused',
        unpermitted.error?.kind === 'NOT_PERMITTED' && seatless.error?.kind === 'REFUSED',
        [unpermitted, seatless]
    );

    const handed = [];
    const asks = [];
    const tells = SEAT.serve({
        input: (seat, event) => (handed.push([seat.id, event]), { over: 'w1', key: 'key', holder: seat.id }),
        read: (seat, query) => ({ text: `desktop for ${seat.id} ${JSON.stringify(query)}`, mark: 1 }),
        onAsk: ({ user }, { signal }) => (asks.push({ user, signal }), Promise.resolve(user === 'guest')),
    });
    check(
        'the seats are served once',
        (() => {
            try {
                SEAT.serve({});
            } catch {
                return true;
            }
        })(),
        ''
    );
    const denied = await SEAT.admit({ transport: 't2', principal: 'other' }, hooks).catch((error) => error);
    const admitted = await SEAT.admit(proof, hooks);
    check(
        'what is served answers the ask: no refuses, yes seats the user, and the ask is over either way',
        denied.kind === 'REFUSED' && admitted.seat.id === 's1' && asks.every(({ signal }) => signal.aborted),
        [denied.message, admitted]
    );
    check('a seat opens as its user is seated', opened.join() === 'local,s1' && SEAT.list().length === 2, opened);
    const pressed = await guest.ask('seat/pointer', pointer);
    const read = await guest.ask('seat/read', { level: 'desktop' });
    const captured = await guest.ask('seat/capture', {});
    const malformed = await guest.ask('seat/pointer', { type: 'down' });
    check(
        'what a seat does and reads is handed to what is served with the seat, and answered as it answers',
        pressed.value?.holder === 's1' &&
            JSON.stringify(handed) === JSON.stringify([['s1', { event: 'pointer', ...pointer }]]) &&
            read.value?.text === 'desktop for s1 {"level":"desktop"}',
        [pressed, handed, read]
    );
    check(
        'what is not served, and what is not the fields of its method, is refused',
        captured.error?.kind === 'REFUSED' && !!malformed.error && handed.length === 1,
        [captured, malformed]
    );
    const [seat] = SEAT.list().slice(1);
    tells.changed(seat, { mark: 2 });
    const watched = await guest.ask('seat/watch', { on: true });
    tells.changed(seat, { mark: 3 });
    tells.held(seat, { window: 'w1', holder: 'local' });
    check(
        'a seat is told of a change while it watches, and that its key window was taken',
        watched.value === true &&
            JSON.stringify(told.get('guest').map(({ payload }) => payload)) ===
                JSON.stringify([{ mark: 3 }, { window: 'w1', holder: 'local' }]),
        told.get('guest')
    );
    for (const listener of outside) listener({ mod: { id: 'guest' }, state: 'running' });
    const still = SEAT.list().length;
    for (const listener of outside) listener({ mod: { id: 'guest' }, state: 'notRunning' });
    const after = await guest.ask('seat/pointer', pointer);
    check(
        'a seat closes as its run reaches not running, and its sender sits at none',
        still === 2 && closed.join() === 's1' && SEAT.list().length === 1 && after.error?.kind === 'REFUSED',
        [still, closed, after]
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} seat checks`);
}

main().catch((error) => {
    console.error('[test] ' + error.stack);
    process.exit(1);
});
