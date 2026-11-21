// The local sockets of deckit's folder by their names (deckit-electron/socket, cli/outside/socket.js), under a folder
// whose path is longer than a socket's may be: the environment's listener at `<home>/deckit.sock` under a stand-in for
// the host, a party of it, that party's relay at `<home>/seats/<user>.sock` and what speaks to the relay. Each name is
// a link to a socket only its owner opens, a request goes each way, the party detaches, and nothing is left. Where no
// short path is to be had the listener and the relay say so in words, and under a short folder a socket is at its
// name. Exits 1 with a line for each check that failed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { makeKey, connect } = require('../outside/client.js');
const RELAY = require('../outside/relay.js');
const SOCKET = require('../outside/socket.js');
const { until } = require('./devtools.js');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
// How long the path of the long folder is, in bytes.
const LONG = 200;
const USER = 'ada';
// What the stand-in for the host answers a party.
const ANSWERS = {
    initialize: () => ({ protocol: 1, challenge: Buffer.alloc(32).toString('base64') }),
    authenticate: ({ principal }) => ({ principal, run: 1, seat: { id: 's1' } }),
    'seat/read': ({ of }) => ({ of, mark: 7 }),
};

const refusedWith = (promise) =>
    promise.then(
        () => null,
        ({ message }) => message
    );
const entryOf = (file) => fs.lstatSync(file, { throwIfNoEntry: false });
// Where the name `file` links to, a socket only its owner opens at a path a socket's may be, or null.
const linked = (file) => {
    if (!entryOf(file)?.isSymbolicLink()) return null;
    const place = fs.readlinkSync(file);
    const there = fs.statSync(place, { throwIfNoEntry: false });
    const held = there?.isSocket() && (there.mode & 0o777) === 0o600 && Buffer.byteLength(place) <= SOCKET.LIMIT;
    return held ? place : null;
};

async function main() {
    // The environment's modules reach Node's by `require`, as the bundle they run in gives it.
    globalThis.require = require;
    const { listen } = await import(url('deckit-electron', 'socket', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The host: it answers a party by ANSWERS, closes the party that quits, and asks and tells the last one opened.
    const hosted = (file) => {
        const host = { failures: [], ended: 0 };
        const answers = new Map();
        let questions = 0;
        const opened = (connection) => {
            const send = (message) => connection.send(JSON.stringify({ jsonrpc: '2.0', ...message }));
            host.ask = (method, params) =>
                new Promise((resolve) => {
                    answers.set(++questions, resolve);
                    send({ id: questions, method, params });
                });
            host.tell = (method, params) => send({ method, params });
            const onMessage = (line) => {
                const { id, method, params, result } = JSON.parse(line);
                if (method === undefined) return answers.get(id)?.(result);
                if (method !== 'runner/quit') return send({ id, result: ANSWERS[method](params) });
                send({ id, result: true });
                connection.close();
            };
            return { onMessage, onEnd: () => host.ended++ };
        };
        const failed = (why) => host.failures.push(why);
        return Object.assign(host, listen({ path: file, limit: 4096 }, { opened, failed }));
    };

    const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-test-socket-')));
    const temporary = process.env.TMPDIR;
    try {
        const home = path.join(scratch, 'h'.repeat(LONG - Buffer.byteLength(scratch) - 1));
        const socket = path.join(home, 'deckit.sock');
        const relay = RELAY.fileOf(home, USER);
        fs.mkdirSync(home);
        // What a run that did not end well left: a link to nothing.
        fs.symlinkSync(path.join(scratch, 'gone.sock'), socket);

        const host = hosted(socket);
        const bound = linked(socket);
        check(
            'a socket under a long folder is bound at a short path its name links to, which only its owner opens',
            Buffer.byteLength(home) === LONG && bound && !host.failures.length,
            [Buffer.byteLength(home), bound, host.failures]
        );

        const party = await connect(socket);
        const admitted = await party.authenticate({ principal: USER, ...makeKey() });
        party.on('runner/stop', () => 'stopping');
        const detach = () => party.request('runner/quit', {}).catch(() => party.close());
        const close = await RELAY.serve({ party, file: relay, detach });
        const relayed = linked(relay);
        check(
            'a party attaches under a long folder, and its relay is bound as the socket is',
            admitted.seat?.id === 's1' && relayed && relayed !== bound && String(RELAY.attached(home)) === USER,
            [admitted, relayed, RELAY.attached(home)]
        );

        const seat = await connect(relay);
        const heard = [];
        seat.on('seat/output', (told) => heard.push(told));
        const read = await seat.request('seat/read', { of: 'desktop' });
        const stopping = await host.ask('runner/stop', {});
        host.tell('seat/output', { of: 'changes' });
        await until(() => heard.length, 2000);
        check(
            'a request goes each way: the relay passes on what is asked of the host, the party answers the host',
            JSON.stringify([read, stopping, heard]) === '[{"of":"desktop","mark":7},"stopping",[{"of":"changes"}]]',
            [read, stopping, heard]
        );

        const detached = await seat.request(RELAY.DETACH, {});
        await party.closed;
        close();
        seat.close();
        await until(() => host.ended === 1, 2000);
        host.close();
        const left = [socket, bound, relay, relayed].filter(entryOf);
        const after = await refusedWith(connect(socket));
        check(
            'a party detaches, and nothing is left: no socket, and no link to one',
            detached === true && host.ended === 1 && !left.length && !fs.readdirSync(path.dirname(relay)).length,
            [detached, host.ended, left]
        );
        check('a name nothing listens at is refused in words', after === `nothing listens at ${socket}`, after);

        // No short path is to be had: the temporary folder's own is too long for a socket.
        process.env.TMPDIR = path.join(scratch, 't'.repeat(LONG - Buffer.byteLength(scratch) - 1));
        fs.mkdirSync(process.env.TMPDIR);
        const nowhere = hosted(socket);
        const unserved = await refusedWith(RELAY.serve({ party, file: relay, detach }));
        nowhere.close();
        const words = new RegExp(`bytes long, and a local socket's path holds at most ${SOCKET.LIMIT}$`);
        check(
            'where no short path is to be had, the listener and the relay say so in words, and nothing is left',
            nowhere.failures.length === 1 &&
                words.test(nowhere.failures[0]) &&
                words.test(unserved) &&
                ![socket, relay].some(entryOf) &&
                !fs.readdirSync(process.env.TMPDIR).length,
            [nowhere.failures, unserved]
        );

        const near = path.join(scratch, 'near', 'deckit.sock');
        fs.mkdirSync(path.dirname(near));
        const beside = hosted(near);
        const there = entryOf(near);
        const reached = await connect(near);
        const answered = await reached.request('seat/read', { of: 'window' });
        reached.close();
        beside.close();
        check(
            'a socket under a short folder is at its name, which only its owner opens, and goes as it closes',
            there?.isSocket() && (there.mode & 0o777) === 0o600 && answered.of === 'window' && !entryOf(near),
            [there?.mode, answered, beside.failures]
        );
    } finally {
        if (temporary === undefined) delete process.env.TMPDIR;
        else process.env.TMPDIR = temporary;
        fs.rmSync(scratch, { recursive: true, force: true });
    }

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} socket checks`);
}

main().catch((error) => {
    console.error('[test] ' + error.stack);
    process.exit(1);
});
