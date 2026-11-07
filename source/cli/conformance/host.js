// The conformance runner's host app: Electron's main process embedding the deckit archive beside it as any host app
// does, through the environment and connect, set up as the case's [host] says. It reaches deckit only through what
// connect answers, and talks to the runner over a socket, a JSON message a line: it says once whether the start settled
// or was refused (deckit.whenStarted()), answers each look it is asked, and quits when asked.
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
    deckit = DECKIT.connect(environment, {
        host: { notificationClicked: () => {}, restart: () => {} },
        config: {
            id: 'deckit-conformance',
            name: 'Deckit conformance',
            api: setup.api,
        },
        folders: { home: setup.home, ship: setup.ship, sources: setup.sources },
    });
    for (const field of setup.fields) deckit.fields.define(field);
    for (const permission of setup.permissions) deckit.permissions.define(permission);
    // The start is complete, the launches at start included, or refused with its kind.
    deckit.whenStarted().then(() => settle({}), refused);
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
        else say({ id: asked.id, came: look(asked) });
    }
});
socket.on('close', () => app.exit(0));

// What a look comes to: `{ answers }`, `{ refuses, kind, message }` for a bundle found and not taken or a run refused,
// or `{ none }` with what the host was given instead. deckit.mods.list() holds every bundle found, in its order.
function look({ look: what, mod, part }) {
    if (!deckit) return { none: 'deckit was not connected' };
    const found = deckit.mods.list();
    if (what === 'mods') return { answers: found.map(({ id }) => id) };
    if (what !== 'mod' && what !== 'run') return { none: `this host answers no look ${what}` };
    const one = found.find((entry) => entry.id === mod);
    if (!one) return { none: `no bundle under the id ${mod} was found` };
    if (one.refusal) return { refuses: one.refusal.stage, kind: one.refusal.kind, message: one.refusal.message };
    if (what === 'run') return runOf(mod);
    const answer = JSON.parse(JSON.stringify(one));
    if (part === undefined) return { answers: answer };
    return part in answer && answer[part] !== null
        ? { answers: answer[part] }
        : { none: `the bundle answers no ${part}` };
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

