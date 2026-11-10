// The conformance runner's host app: Electron's main process embedding the deckit archive beside it as any host app
// does, through the environment and connect, set up as the case's [host] says. It reaches deckit only through what
// connect answers, and talks to the runner over a socket, a JSON message a line: it says once whether the start settled
// or was refused (deckit.whenStarted()), answers each call and look it is asked, a start and a call once no run is
// between two states, and quits when asked. It stacks a layer of its own over deckit on each mod's page (page.js),
// which makes the requests a call hands it and keeps what its listeners heard, attaches the web engine on the bases web
// and shell and the shell over it on the base shell, runs main process modules where an owner it ships asks for them,
// and opens none of the addresses it is handed to open outside the app: it keeps each one, for the look opened. On the
// base web it shows a mod's page in a window of its own once its layer shows a web page there, and presses a web page
// its layer showed with WebKit's input, as a person's press comes. It shows none of the system's notifications: it
// keeps each one, for the look shown, and presses one when asked. It knows the app for an address of a scheme only
// where the case names one. Its clipboard is a file of the run's, never the person's. A request fetched through a web
// session reaches no address but on the loopback address.
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
let show = null; // the channel to the conformance layer that shows a web page
let delegated = null;
let quiet = null; // the channel to the conformance layer that waits until the pages it shows are quiet
let engine = null; // what attachWeb answered, on the base web
let webkit = null; // WebKit's module, which presses a web page
const adopted = []; // each web page, in the order adopted, on the base web
const showed = new Map(); // a show's place -> the web page it showed
const windowed = new WeakSet(); // the mods' pages shown in a window of the host's
const opened = []; // { url, activates }: each address handed to open outside the app, in the order handed
const shown = []; // { notification: { title, body, silent }, onClick }: each notification handed to show, in order
// What the host app answers the shell: nothing it is asked to show is shown.
const SHOWS_NOTHING = Object.freeze({
    start() {},
    show() {},
    desktopTitled() {},
    showWindow() {},
    closeWindow() {},
});

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
        // The app for an address of a scheme the case names one for, and none for any other.
        appFor: (url) => setup.apps[new URL(url).protocol.slice(0, -1).toLowerCase()] ?? '',
        // A file kept as the file URL of its path, each segment of it percent-encoded.
        file: async (file, { activate = true } = {}) => {
            opened.push({ url: 'file://' + file.split('/').map(encodeURIComponent).join('/'), activates: activate });
            return true;
        },
    });
    // Each notification kept, and answered as one the system took; a press calls its onClick.
    const notifications = Object.freeze({
        show: async ({ title, body, silent }, { onClick }) => {
            shown.push({ notification: { title, body, silent }, onClick });
            return true;
        },
    });
    // The clipboard's text in the run's file, '' while there is none: it stands as the host app quits and starts.
    const clipboard = Object.freeze({
        readText: () => (fs.existsSync(setup.clipboard) ? fs.readFileSync(setup.clipboard, 'utf8') : ''),
        writeText: (text) => fs.writeFileSync(setup.clipboard, text),
    });
    // A request fetched through a session reaches no address but on the loopback address, where the runner serves the
    // case's sites: one to another address is not answered.
    const web = Object.create(environment.web, {
        fetch: {
            value: async (mod, session, request) => {
                if (new URL(request.url).hostname !== '127.0.0.1')
                    throw new Error(`${request.url} is not on the loopback address`);
                return environment.web.fetch(mod, session, request);
            },
        },
    });
    const given = Object.create(environment, {
        web: { value: web },
        open: { value: open },
        notifications: { value: notifications },
        clipboard: { value: clipboard },
    });
    deckit = DECKIT.connect(given, {
        host: { notificationClicked: () => {}, restart: () => {} },
        config: {
            id: setup.id,
            name: 'Deckit conformance',
            api: setup.api,
        },
        folders: { home: setup.home, ship: setup.ship, sources: setup.sources },
    });
    // On the base web, the host's layer is over the web engine, the layer over it that it offers web pages to.
    if (setup.base !== 'web') deckit.stack('conformance');
    // Main process modules run, as a host app runs them, where an owner the case ships asks for them.
    if (setup.mainProcess) ELECTRON.attachMainProcess(deckit, given);
    // On the base web, the web engine is attached as a host app attaches it, and on the base shell the shell over it,
    // shown nowhere, before the case's fields and permissions, which come after the base's.
    if (setup.base === 'web') {
        engine = DECKIT.attachWeb(deckit, given);
        engine.onPage((page) => adopted.push(page));
        deckit.stack('conformance');
        // WebKit's module is the core's neighbour in the archive.
        webkit = { exports: {} };
        process.dlopen(webkit, path.join(path.dirname(path.join(LIBRARY, described.core)), 'deckit-web.node'));
        webkit = webkit.exports;
    }
    if (setup.base === 'shell')
        DECKIT.attach(deckit, given, { host: SHOWS_NOTHING, web: DECKIT.attachWeb(deckit, given) });
    for (const field of setup.fields) deckit.fields.define(field);
    for (const permission of setup.permissions) deckit.permissions.define(permission);
    call = deckit.channels.bind({ channel: 'conformance/call', to: 'page', reply: true });
    heard = deckit.channels.bind({ channel: 'conformance/heard', to: 'page', reply: true });
    show = deckit.channels.bind({ channel: 'conformance/show', to: 'page', reply: true });
    delegated = deckit.channels.bind({ channel: 'conformance/delegated', to: 'page', reply: true });
    quiet = deckit.channels.bind({ channel: 'conformance/quiet', to: 'page', reply: true });
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
            Promise.resolve(
                asked.input === 'call' || asked.input === 'show'
                    ? request(asked)
                    : asked.input === 'press'
                      ? press(asked)
                      : asked.input === 'activate'
                        ? activate(asked)
                        : look(asked)
            ).then(async (came) => {
                if (asked.input) await runsSettled();
                say({ id: asked.id, came });
            });
    }
});
socket.on('close', () => app.exit(0));

// What a call comes to: what the request the mod's run makes answers, `{ refuses, kind, message }` for its refusal, or
// `{ none }` where no run of the mod is running or its handle has no such member. `args` are the folders' paths and
// then the values the step writes; `step` its place, `handle` the name of the handle `member` starts at, `of` the
// place of the call whose answer it starts at instead, or whose listener's, where `handed`, and `listener` whether the
// request is handed one after its args.
async function request({ input, mod, member, args, step, handle, of, listener, handed, ...shows }) {
    const running = runningOf(mod);
    if (!running.page) return running;
    try {
        if (input === 'show') {
            showInWindow(running.page);
            const from = adopted.length;
            const came = await show.invoke(running.page, { step, ...shows });
            const page = adopted.slice(from).find((one) => engine.pageFor(one) === running.page);
            if (page) showed.set(step, page);
            return came;
        }
        return await call.invoke(running.page, { member, args, step, handle, of, listener, handed });
    } catch (error) {
        return { refuses: error.stage ?? null, kind: error.kind ?? null, message: String(error.message) };
    }
}

// What a press comes to: the notification at the place `notification` in what shown answers pressed, `{}`, or
// `{ none }` where there is none there.
function press({ notification }) {
    const one = shown[notification - 1];
    if (!one) return { none: `no notification was shown at ${notification}` };
    one.onClick();
    return {};
}

// What an activate comes to: the web page the show at the place `of` showed pressed with the mouse's button, down and
// up, inside it, `{}` once the pages the layer shows are quiet, or `{ none }` where it is not there.
async function activate({ mod, of }) {
    const running = runningOf(mod);
    if (!running.page) return running;
    const page = showed.get(of);
    if (!page || page.isDestroyed()) return { none: `step ${of} showed no web page that is there` };
    try {
        for (const type of ['down', 'up']) webkit.sendMouse(page.id, { type, x: PRESSED.x, y: PRESSED.y });
    } catch (error) {
        return { none: `the page took no press: ${error.message}` };
    }
    return quiet.invoke(running.page, {});
}

// A mod's page, on the base web, shown in a window of the host's, filled by it, so that the web pages laid over it are
// on screen and take input: once.
function showInWindow(page) {
    if (setup.base !== 'web' || windowed.has(page)) return;
    windowed.add(page);
    const window = environment.windows.open({ size: { width: 800, height: 600 } });
    const stage = environment.stage();
    stage.place(window);
    const lay = () => stage.lay([{ page, rect: { x: 0, y: 0, ...stage.size() } }]);
    stage.whenResized(lay);
    lay();
    window.show({ focus: false });
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
    if (what === 'shown') return { answers: shown.map(({ notification }) => notification) };
    if (what === 'heard' || what === 'delegated') {
        const running = runningOf(mod);
        return running.page ? (what === 'heard' ? heard : delegated).invoke(running.page) : running;
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

// Where in a web page a press lands: from its top left.
const PRESSED = Object.freeze({ x: 10, y: 10 });

// A page deckit shows on its own, in a window of the environment's, shown without taking the keyboard.
function openWindow({ title = '', size = null, place }) {
    const window = environment.windows.open({ title, size: size || { width: 800, height: 600 } });
    place(window);
    window.show({ focus: false });
    return window;
}
