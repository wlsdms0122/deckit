// The conformance runner's host app: Electron's main process embedding the deckit archive beside it as any host app
// does, through the environment, connect and, for the shell, attach, set up as the case's [host] says. It reaches deckit
// only through what connect answers, and talks to the runner over a socket, a JSON message a line: it says once
// whether the start settled or was refused, answers each look it is asked, and quits when asked.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { app, globalShortcut } = require('electron');

const setup = JSON.parse(fs.readFileSync(process.env.DECKIT_CONFORMANCE_SETUP, 'utf8'));
const LIBRARY = path.join(__dirname, 'deckit');
// The states a run passes through between two others, as a run's facts name them.
const MOVING = ['launching', 'terminating'];
// How often whether the app has settled is looked at.
const POLL = 50;

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
        config: { id: 'deckit-conformance', name: 'Deckit conformance' },
        folders: { home: setup.home, ship: setup.ship, sources: setup.sources },
    });
    if (setup.base === 'shell') DECKIT.attach(deckit, environment, { host: shellHost() });
    for (const field of setup.fields) deckit.fields.define(field);
    for (const permission of setup.permissions) deckit.permissions.define(permission);
    deckit.core.onDown((why) => refused(why));
    deckit.onStart(() => whenStill().then(() => settle({})));
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

// What a look comes to: `{ answers }`, or `{ none }` with what the host was given instead.
function look({ look: what, mod, part }) {
    if (what === 'mods')
        return { none: 'a host is given only the bundles that load (deckit.mods.list()), not every bundle found' };
    if (what !== 'mod') return { none: `this host answers no look ${what}` };
    const found = deckit?.mods.list().find((one) => one.id === mod);
    if (!found)
        return {
            none: `no bundle under the id ${mod} is given to a host, and no refusal: deckit.mods.list() gives only the bundles that load`,
        };
    const answer = JSON.parse(JSON.stringify(found));
    if (part === undefined) return { answers: answer };
    return part in answer && answer[part] !== null
        ? { answers: answer[part] }
        : { none: `the bundle answers no ${part}` };
}

// Resolves once no run is between two states.
function whenStill() {
    return new Promise((resolve) => {
        const poll = () => {
            if (deckit.mods.runs().some(({ run }) => MOVING.includes(run.state))) setTimeout(poll, POLL);
            else resolve();
        };
        setTimeout(poll, POLL);
    });
}

// A page deckit shows on its own, in a window of the environment's, shown without taking the keyboard.
function openWindow({ title = '', size = null, place }) {
    const window = environment.windows.open({ title, size: size || { width: 800, height: 600 } });
    place(window);
    window.show({ focus: false });
    return window;
}

// Where the shell is shown: this host shows the shell nowhere, and answers each request it is made.
function shellHost() {
    return {
        start: () => {},
        showsPanel: () => false,
        show: () => {},
        dismiss: () => {},
        panelTitled: () => {},
        showWindow: () => {},
        hideWindow: () => {},
        closeWindow: () => {},
    };
}
