// One run of a case: its bundles laid out afresh in a folder of the run's own, the host app started and quit as its
// steps say, each look asked of it, and what each step came to held to what it expects (spec/DECKIT-1).
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const TOML = require('./toml.js');

// How long the app is given to settle after an input.
const SETTLE = 10000;

// Why the runner does not take a case, or null: a base or a step it would measure against a DECKIT not yet written, or
// a bundle to drive.
function cannotRun({ host, drive, steps }) {
    if (host.base === 'app')
        return 'base "app" is Deckit.app as it ships, and its entry (deckit-app/main.js) takes no host a case adds to';
    if (drive.length) return "a driven bundle's handle is the handle's DECKIT's, and none is written";
    const why = {
        call: "what a call's member names is the handle's DECKIT's, and none is written",
        key: "a chord and where the keyboard is are the keys' and the shell's DECKITs', and none is written",
        click: 'a place shown is named by the DECKIT that shows it, and none is written',
        type: "where the keyboard is is the shell's DECKITs', and none is written",
        time: "a host is given no clock of the app's to move",
        run: "a run's states are the lifecycle's DECKIT's, and none is written",
        heard: 'a function is handed by a driven bundle, and this runner drives none',
        shown: 'a place shown is named by the DECKIT that shows it, and none is written',
    };
    for (const step of steps) if (why[step.what]) return `step ${step.number} (${step.what}): ${why[step.what]}`;
    return null;
}

// Runs `theCase` in `folder`, made afresh, on the host app in `hostApp` that Electron at `electron` runs: `{ passed }`,
// or `{ passed: false, step, came, expected }` for its first step that did not match, `step` null where the host could
// not be set up.
async function run(theCase, { folder, hostApp, electron }) {
    const { host, bundles } = theCase;
    fs.rmSync(folder, { recursive: true, force: true });
    const home = path.join(folder, 'home');
    const sources = path.join(folder, 'sources');
    for (const made of [home, path.join(folder, 'electron'), path.join(folder, 'downloads')])
        fs.mkdirSync(made, { recursive: true });
    for (const name of host.sources)
        fs.cpSync(bundles[name], path.join(sources, name), { recursive: true, verbatimSymlinks: true });
    const ship = host.ship.map((name) => {
        const to = path.join(folder, 'ship', name);
        fs.cpSync(bundles[name], to, { recursive: true, verbatimSymlinks: true });
        return { folder: to, system: host.system.includes(name) };
    });

    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const setupFile = path.join(folder, 'setup.json');
    fs.writeFileSync(
        setupFile,
        JSON.stringify(
            {
                port: server.address().port,
                base: host.base,
                // The contract version deckit runs mods with, where the case names one (base "system").
                ...(host.api === null ? {} : { api: host.api }),
                preload: 'preload.js',
                home,
                electron: path.join(folder, 'electron'),
                downloads: path.join(folder, 'downloads'),
                fields: host.fields,
                permissions: host.permissions,
                ship,
                sources: host.sources.length ? [sources] : [],
            },
            null,
            4
        )
    );
    const log = fs.openSync(path.join(folder, 'host.log'), 'a');
    const app = createApp({ server, electron, hostApp, setupFile, log });
    try {
        for (const step of theCase.steps) {
            const came = await take(step, app);
            if (!matches(step.expect, came))
                return { passed: false, step, came: describe(came), expected: describe(step.expect) };
        }
        return { passed: true };
    } finally {
        await app.end();
        server.close();
        fs.closeSync(log);
    }
}

// What a step comes to: `{ answers }`, `{ refuses, kind, message }`, `{ none }` with why there is no answer, or `{}`
// for an input answered with nothing.
async function take(step, app) {
    if (step.what === 'start') return app.start();
    if (step.what === 'quit') return app.quit();
    const { kind, what, number, expect, ...asked } = step;
    return app.ask({ look: what, ...asked });
}

// The host app, started and quit as the steps say: each start a process of its own, on the run's folders.
function createApp({ server, electron, hostApp, setupFile, log }) {
    let child = null;
    let socket = null;
    let asked = 0;
    const waiting = new Map(); // what is asked of the app -> its resolve
    server.on('connection', (connected) => {
        socket = connected;
        let buffered = '';
        connected.on('data', (chunk) => {
            buffered += chunk;
            for (let end; (end = buffered.indexOf('\n')) >= 0;) {
                const message = JSON.parse(buffered.slice(0, end));
                buffered = buffered.slice(end + 1);
                const key = 'settled' in message ? 'settled' : message.id;
                waiting.get(key)?.('settled' in message ? message.settled : message.came);
                waiting.delete(key);
            }
        });
    });

    // Resolves to what the app answers under `key`, or to `{ none }` once it ends or has not settled in time.
    const answer = (key) =>
        new Promise((resolve) => {
            const timer = setTimeout(
                () => resolve({ none: `the app did not settle within ${SETTLE / 1000} s` }),
                SETTLE
            );
            const done = (came) => {
                clearTimeout(timer);
                resolve(came);
            };
            waiting.set(key, done);
            child?.once('exit', (code, signal) => done({ none: `the host app ended (${signal || code})` }));
        });

    function start() {
        const env = { ...process.env, DECKIT_CONFORMANCE_SETUP: setupFile };
        delete env.ELECTRON_RUN_AS_NODE;
        child = spawn(electron, [hostApp], { env, stdio: ['ignore', log, log] });
        child.once('exit', () => {
            child = null;
            socket = null;
        });
        return answer('settled');
    }

    async function quit() {
        if (!child) return { none: 'the app is not running' };
        const exited = new Promise((resolve) => child.once('exit', resolve));
        socket?.write(JSON.stringify({ quit: true }) + '\n');
        const timer = new Promise((resolve) => setTimeout(() => resolve('late'), SETTLE));
        return (await Promise.race([exited, timer])) === 'late'
            ? { none: `the app did not quit within ${SETTLE / 1000} s` }
            : {};
    }

    function ask(look) {
        if (!socket) return Promise.resolve({ none: 'the app is not running' });
        const id = ++asked;
        const answered = answer(id);
        socket.write(JSON.stringify({ id, ...look }) + '\n');
        return answered;
    }

    // The app ended, as asked and then killed, once the case is done.
    async function end() {
        if (!child) return;
        const running = child;
        const exited = new Promise((resolve) => running.once('exit', resolve));
        running.kill('SIGTERM');
        const killed = setTimeout(() => running.kill('SIGKILL'), 3000);
        await exited;
        clearTimeout(killed);
    }

    return { start, quit, ask, end };
}

// Whether a step came to what it expects: an input that expects nothing is not refused and answers.
function matches(expect, came) {
    if (!expect) return !came.refuses && !came.none;
    if ('answers' in expect) return 'answers' in came && same(expect.answers, came.answers);
    return came.refuses === expect.refuses && came.kind === expect.kind;
}

// Values matched strictly; a key answered with null is a key not answered.
function same(expected, actual) {
    if (Array.isArray(expected))
        return (
            Array.isArray(actual) &&
            actual.length === expected.length &&
            expected.every((one, at) => same(one, actual[at]))
        );
    if (TOML.isTable(expected)) {
        if (!TOML.isTable(actual)) return false;
        const answered = Object.keys(actual).filter((key) => actual[key] !== null);
        const keys = Object.keys(expected);
        return (
            answered.length === keys.length &&
            keys.every((key) => answered.includes(key) && same(expected[key], actual[key]))
        );
    }
    return expected === actual;
}

function describe(came) {
    if (!came) return 'not to be refused';
    if ('answers' in came) return `answers ${JSON.stringify(came.answers)}`;
    if (came.refuses)
        return `a refusal at ${came.refuses}, ${came.kind ? `kind ${came.kind}` : 'with no kind'}${came.message ? ` ("${came.message}")` : ''}`;
    if (came.none) return `nothing: ${came.none}`;
    return 'nothing';
}

module.exports = { cannotRun, run };
