// The conformance runner's host app: Electron's main process embedding the deckit archive beside it as any host app
// does, through the environment and connect, set up as the case's [host] says. It reaches deckit only through what
// connect answers, and talks to the runner over a socket, a JSON message a line: it says once whether the start settled
// or was refused (deckit.whenStarted()), answers each call and look it is asked, a start and a call once no run is
// between two states, and quits when asked. It stacks a
// layer of its own over deckit on each mod's page (page.js), which makes the requests a call hands it and keeps what
// its listeners heard, and opens none of the addresses it is handed to open outside the app: it keeps each one, for the
// look opened.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { app, globalShortcut } = require('electron');

const setup = JSON.parse(fs.readFileSync(process.env.DECKIT_CONFORMANCE_SETUP, 'utf8'));
const LIBRARY = path.join(__dirname, 'deckit');

// It never takes the person's screen, keyboard or chords: the runner hands every input itself.
app.setPath('userData', setup.electron);
app.setPath('downloads', setup.downloads);
app.focus = () => {};
globalShortcut.register = () => true;
globalShortcut.unregister = () => {};
app.whenReady().then(() => app.setActivationPolicy('accessory'));

const socket = net.connect(setup.port, '127.0.0.1');
const say = (message) => socket.write(JSON.stringify(message) + '\n');
let environment = null;
let deckit = null;
let settled = false;
let call = null; // the channels to the conformance layer on a mod's page
let heard = null;
const opened = []; // { url, activates }: each address handed to open outside the app, in the order handed

const settle = (came) => {
    if (settled) return;
    settled = true;
    say({ settled: came });
};
// A host's own request refused: everything it hands deckit before the start is part of starting it.
const refused = (error) =>
    settle({ refuses: 'call', kind: error?.kind ?? null, message: String(error?.message ?? error) });

try {
    const ELECTRON = require(path.join(LIBRARY, 'main.js'));
    const DECKIT = require(path.join(LIBRARY, 'shell-main.js'));
    const described = JSON.parse(fs.readFileSync(path.join(LIBRARY, 'deckit.json'), 'utf8'));
    environment = ELECTRON.environment({
        preload: path.join(__dirname, setup.preload),
        core: path.join(LIBRARY, described.core),
        host: { openWindow },
    });
    const open = Object.freeze({
        ...environment.open,
        url: async (url, { activate = true } = {}) => {
            opened.push({ url, activates: activate });
        },
        // A file kept as the file URL of its path, each segment of it percent-encoded.
        file: async (file, { activate = true } = {}) => {
            opened.push({ url: 'file://' + file.split('/').map(encodeURIComponent).join('/'), activates: activate });
            return true;
        },
    });
    deckit = DECKIT.connect(Object.create(environment, { open: { value: open } }), {
        host: { notificationClicked: () => {}, restart: () => {} },
        config: {
            id: setup.id,
            name: 'Deckit conformance',
            api: setup.api,
        },
        folders: { home: setup.home, ship: setup.ship, sources: setup.sources },
    });
    for (const field of setup.fields) deckit.fields.define(field);
    for (const permission of setup.permissions) deckit.permissions.define(permission);
    deckit.stack('conformance');
    call = deckit.channels.bind({ channel: 'conformance/call', to: 'page', reply: true });
    heard = deckit.channels.bind({ channel: 'conformance/heard', to: 'page', reply: true });
    // The start is complete, the launches at start included, or refused with its kind.
    deckit.whenStarted().then(() => runsSettled().then(() => settle({})), refused);
} catch (error) {
    refused(error);
}

let buffered = '';
socket.on('data', (chunk) => {
    buffered += chunk;
    for (let end; (end = buffered.indexOf('\n')) >= 0;) {
        const asked = JSON.parse(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
        if (asked.quit) app.quit();
        else
            Promise.resolve(asked.input === 'call' ? request(asked) : look(asked)).then(async (came) => {
                if (asked.input === 'call') await runsSettled();
                say({ id: asked.id, came });
            });
    }
});
socket.on('close', () => app.exit(0));

// What a call comes to: what the request the mod's run makes answers, `{ refuses, kind, message }` for its refusal, or
// `{ none }` where no run of the mod is running or its handle has no such member. `args` are the folders' paths and
// then the values the step writes; `step` its place, `of` the place of the call whose answer `member` starts at, and
// `listener` whether the request is handed one after its args.
async function request({ mod, member, args, step, of, listener }) {
    const running = runningOf(mod);
    if (!running.page) return running;
    try {
        return await call.invoke(running.page, { member, args, step, of, listener });
    } catch (error) {
        return { refuses: error.stage ?? null, kind: error.kind ?? null, message: String(error.message) };
    }
}

// The running run of the mod listed under `mod`, `{ page }`, or `{ none }`.
function runningOf(mod) {
    if (!deckit) return { none: 'deckit was not connected' };
    const running = deckit.mods.runs().find(({ run }) => run.mod.id === mod && run.state === 'running');
    return running ? { page: running.page } : { none: `no run of ${mod} is running` };
}

// Resolves once no run is between two states: each has started, or has ended.
async function runsSettled() {
    const moving = ({ run }) => run.state === 'launching' || run.state === 'terminating';
    while (deckit?.mods.runs().some(moving)) await new Promise((resolve) => setTimeout(resolve, 10));
}

// What a look comes to: `{ answers }`, `{ refuses, kind, message }` for a bundle found and not taken or a run refused,
// or `{ none }` with what the host was given instead. deckit.mods.list() holds every bundle found, in its order.
function look({ look: what, mod }) {
    if (!deckit) return { none: 'deckit was not connected' };
    if (what === 'opened') return { answers: opened };
    if (what === 'heard') {
        const running = runningOf(mod);
        return running.page ? heard.invoke(running.page) : running;
    }
    const found = deckit.mods.list();
    if (what === 'mods') return { answers: found.map(({ id }) => id) };
    if (what !== 'mod' && what !== 'run') return { none: `this host answers no look ${what}` };
    const one = found.find((entry) => entry.id === mod);
    if (!one) return { none: `no bundle under the id ${mod} was found` };
    if (one.refusal) return { refuses: one.refusal.stage, kind: one.refusal.kind, message: one.refusal.message };
    if (what === 'run') return runOf(mod);
    return { answers: one };
}

// What deckit answers of the mod's latest run: its state, or the refusal at launch it came to. A mod with no run since
// the start does not run.
function runOf(id) {
    const run = deckit.mods.runOf(id);
    if (!run) return { answers: 'notRunning' };
    if (run.refusal) return { refuses: run.refusal.stage, kind: run.refusal.kind, message: run.refusal.message };
    return { answers: run.state };
}

// A page deckit shows on its own, in a window of the environment's, shown without taking the keyboard.
function openWindow({ title = '', size = null, place }) {
    const window = environment.windows.open({ title, size: size || { width: 800, height: 600 } });
    place(window);
    window.show({ focus: false });
    return window;
}
