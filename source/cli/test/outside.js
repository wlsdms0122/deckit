// A party on a transport connection from outside, checked against the app under test through the client of the wire
// (cli/outside): a key registered for a principal attaches as a run of it, any other proof is refused and told
// nothing, a principal that runs takes no second party, and the run asks what a run asks, bounded by a job that grants
// only the seat permission: its own records and events, no connection. The key is registered, listed and removed as a
// host does it, by `deckit key` against the app's folder, while the app runs, and its principal is made a user by the
// core `deckit key` asks. The app's folder is seeded with an idle time of none, so a user sits unasked.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeKey, connect } = require('../outside/client.js');
const { ask } = require('../outside/keys.js');
const { until } = require('./devtools.js');

const refusedWith = (promise) =>
    promise.then(
        () => null,
        ({ message, code, kind = null, stage = null }) => ({ message, code, kind, stage })
    );
const settled = (promise, limit = 5000) =>
    Promise.race([promise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), limit))]);

async function run({ check, home, logged }) {
    const socket = path.join(home, 'deckit.sock');
    const principal = 'outside-party';
    const key = makeKey();
    const deckit = (...args) =>
        execFileSync(path.join(__dirname, '..', 'deckit'), ['key', ...args, '--home', home], { encoding: 'utf8' });
    deckit('add', principal, key.publicKey, '--name', 'test');
    const keyed = await connect(socket);
    const recordless = await refusedWith(keyed.authenticate({ principal, ...key }));
    await ask(home, 'user/add', { id: principal, name: 'Outside Party' });
    const started = { contributions: { exportedIn: {}, awaits: {} } };
    const nothing = { message: 'not authenticated', code: -32803, kind: 'NOT_AUTHENTICATED', stage: 'call' };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    check('outside: only its owner opens the socket', (fs.statSync(socket).mode & 0o777) === 0o600, '');
    check(
        'outside: a registered key of a principal that is no user is refused as a wrong key is',
        same(recordless, nothing),
        JSON.stringify(recordless)
    );

    const early = await connect(socket);
    const before = await refusedWith(early.request('record/keys', {}));
    check('outside: a request before authentication is refused', before?.code === -32002, JSON.stringify(before));
    early.close();

    const stranger = await connect(socket);
    const wrong = await refusedWith(stranger.authenticate({ principal, ...makeKey() }));
    check('outside: a key not registered is refused and told nothing', same(wrong, nothing), JSON.stringify(wrong));
    check('outside: a refused transport connection is closed', await settled(stranger.closed), '');
    const nobody = await connect(socket);
    const unknown = await refusedWith(nobody.authenticate({ principal: 'no-such-principal', ...key }));
    check(
        'outside: a principal with no key is refused as a wrong key is',
        same(unknown, nothing),
        JSON.stringify(unknown)
    );

    const party = await connect(socket);
    const attached = await party.authenticate({ principal, ...key });
    check(
        'outside: a registered key of a user attaches as a run of it, granted the seat permission only',
        attached.principal === principal &&
            attached.run === 1 &&
            same(attached.permissions, ['deckit.seat']) &&
            attached.end > 0,
        JSON.stringify(attached)
    );
    const second = await connect(socket);
    const running = await refusedWith(second.authenticate({ principal, ...key }));
    check(
        'outside: a principal that runs takes no second party',
        running?.kind === 'ALREADY_RUNNING',
        JSON.stringify(running)
    );

    const delivered = [];
    party.on('event/deliver', (event) => delivered.push(event));
    await party.request('runner/started', started);
    await party.request('record/write', { key: 'note', value: { text: 'kept' } });
    const read = await party.request('record/read', { key: 'note' });
    const keys = await party.request('record/keys', {});
    await party.request('record/remove', { key: 'note' });
    const removed = await party.request('record/read', { key: 'note' });
    check(
        'outside: a record round-trips under its principal',
        same(read, { text: 'kept' }) && same(keys, ['note']) && removed === null,
        JSON.stringify({ read, keys, removed })
    );
    await party.request('event/listen', { names: [`${principal}:ping`] });
    await party.request('event/emit', { name: 'ping', args: [1] });
    const heard = await until(() => delivered.length > 0, 3000);
    check(
        'outside: an event arrives, named after its principal',
        heard && same(delivered[0], { name: `${principal}:ping`, args: [1] }),
        JSON.stringify(delivered)
    );
    const connections = await party.request('connection/begin', { lifecycle: 0 });
    const reach = await refusedWith(party.request('connection/reach', { lifecycle: 0, target: 'probe' }));
    check(
        'outside: the job of a user has no connection and reaches none',
        same(connections, []) && reach?.kind === 'NOT_PERMITTED',
        JSON.stringify({ connections, reach })
    );
    const missing = await refusedWith(party.request('no/such', {}));
    check('outside: a method that is none is refused', missing?.code === -32601, JSON.stringify(missing));

    party.close();
    const crashed = await until(() => logged().includes(`${principal}: its transport connection closed`), 5000);
    check('outside: a close without quit is a failed run', crashed, '');
    const again = await connect(socket);
    const next = await until(async () => (await refusedWith(again.request('record/keys', {})))?.code === -32002, 1000);
    const reattached = next && (await again.authenticate({ principal, ...key }).catch((error) => error));
    check(
        'outside: its principal runs again in a new run',
        reattached?.run === 2,
        JSON.stringify(reattached?.message ?? reattached)
    );
    let stopped = false;
    again.on('runner/stop', () => {
        stopped = true;
    });
    await again.request('runner/started', started);
    await again.request('runner/quit', {});
    check(
        'outside: a run that quits is asked to stop, then closed',
        (await settled(again.closed)) && stopped,
        String(stopped)
    );

    const listed = deckit('list', principal);
    check('outside: a key registered is listed', listed === `ed25519 ${key.publicKey} test\n`, listed);
    deckit('remove', principal, key.publicKey);
    const late = await connect(socket);
    const revoked = await refusedWith(late.authenticate({ principal, ...key }));
    check(
        'outside: a key removed as the app runs is refused from then on',
        same(revoked, nothing) && deckit('list', principal) === '',
        JSON.stringify(revoked)
    );
}

module.exports = { run };
