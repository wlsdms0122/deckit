// The channels between main and a page (deckit-electron/deck/ipc), checked over a stand-in for Electron's IPC: main
// and pages, each its own copy of the router, as each is its own bundle. Exits 1 with a line for each check that
// failed. What a page is asked before its code says how to answer cannot be timed in the app, so it is checked here.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const DECKIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'deckit');
const ROUTER = pathToFileURL(path.join(DECKIT, 'deckit-electron', 'deck', 'ipc', 'router.js')).href;
const CHANNEL = await import(pathToFileURL(path.join(DECKIT, 'deckit-driver', 'channel', 'index.js')).href);
const WIRE = await import(pathToFileURL(path.join(DECKIT, 'deckit-electron', 'deck', 'ipc', 'protocol.js')).href);

const tick = () => new Promise((resolve) => setImmediate(resolve));
const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const outcome = (promise) =>
    promise.then(
        (value) => ({ value }),
        (error) => ({ error: error.message, kind: error.kind ?? null })
    );
const failed = [];
let count = 0;
const check = (name, ok, seen) => {
    count++;
    if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
};

// Electron's IPC, as the router uses it: what crosses is cloned and arrives on a later turn.
const ipcMain = {
    listeners: new Map(),
    handlers: new Map(),
    on(channel, listener) {
        this.listeners.set(channel, [...(this.listeners.get(channel) || []), listener]);
    },
    handle(channel, handler) {
        this.handlers.set(channel, handler);
    },
};
const answers = []; // every answer a page sent, as main heard it

function pageNamed(name) {
    const heard = new Map();
    const events = new Map();
    const webContents = {
        name,
        gone: false,
        send(channel, message) {
            const copy = structuredClone(message);
            setImmediate(() => (heard.get(channel) || []).forEach((listener) => listener({}, copy)));
        },
        isDestroyed: () => webContents.gone,
        isCrashed: () => false,
        on: (event, listener) => events.set(event, [...(events.get(event) || []), listener]),
        once: (event, listener) => webContents.on(event, listener),
        emit: (event) => (events.get(event) || []).forEach((listener) => listener()),
    };
    const ipcRenderer = {
        on: (channel, listener) => heard.set(channel, [...(heard.get(channel) || []), listener]),
        send(channel, message) {
            const copy = structuredClone(message);
            if (channel === WIRE.pageAnswers.channel) answers.push({ from: name, ...copy });
            setImmediate(() =>
                (ipcMain.listeners.get(channel) || []).forEach((listener) => listener({ sender: webContents }, copy))
            );
        },
        invoke: (channel, message) =>
            Promise.resolve().then(() =>
                ipcMain.handlers.get(channel)({ sender: webContents }, structuredClone(message))
            ),
        // Main sets returnValue once it has the answer; the page waits for it.
        sendSync(channel, message) {
            const event = { sender: webContents };
            ipcMain.listeners.get(channel).forEach((listener) => listener(event, structuredClone(message)));
            return event;
        },
    };
    return { webContents, ipcRenderer };
}

async function routerIn(side, type, electron) {
    process.type = type;
    globalThis.require = () => electron;
    return import(`${ROUTER}?${side}`);
}

const A = pageNamed('A');
const B = pageNamed('B');
const C = pageNamed('C');
const MAIN = await routerIn('main', 'browser', { ipcMain });
const PAGE_A = await routerIn('a', 'renderer', { ipcRenderer: A.ipcRenderer });
const PAGE_B = await routerIn('b', 'renderer', { ipcRenderer: B.ipcRenderer });

const DECLARED = {
    setup: CHANNEL.pageToMain('deckit-shell:setup', { a: 'string?' }, { reply: true, sync: true }),
    ask: CHANNEL.pageToMain('deckit-shell:ask', { a: 'string' }, { reply: true }),
    tell: CHANNEL.pageToMain('deckit-shell:tell', { a: 'string' }),
    escape: CHANNEL.mainToPage('deckit-shell:escape', { reply: true }),
    state: CHANNEL.mainToPage('deckit-shell:state'),
};
const inMain = CHANNEL.bindAll(MAIN.layerChannels, DECLARED);
const inA = CHANNEL.bindAll(PAGE_A.layerChannels, DECLARED);
const inB = CHANNEL.bindAll(PAGE_B.layerChannels, DECLARED);
inMain.setup.handle((payload, sender) => ({ from: sender.name, payload }));
inMain.ask.handle((payload, sender) => ({ from: sender.name, payload }));
const told = [];
inMain.tell.on((payload, sender) => told.push([sender.name, payload.a]));

// A page asks main, at once and not.
const asked = await outcome(inA.ask.invoke({ a: 'hi' }));
check('a page asks main', asked.value?.from === 'A' && asked.value.payload.a === 'hi', asked);
const refused = await outcome(inA.ask.invoke({ a: 1 }));
check("main refuses what is not the channel's fields", refused.kind === 'REFUSED', refused);
const atOnce = A.ipcRenderer.sendSync(WIRE.pageAsksSync.channel, { channel: 'deckit-shell:setup', payload: {} });
await tick();
check('a page asks main at once', atOnce.returnValue?.value?.from === 'A', atOnce.returnValue);
const notAtOnce = A.ipcRenderer.sendSync(WIRE.pageAsksSync.channel, {
    channel: 'deckit-shell:ask',
    payload: { a: 'x' },
});
await tick();
check(
    'a channel not asked at once is refused at once',
    notAtOnce.returnValue?.error?.kind === 'REFUSED',
    notAtOnce.returnValue
);
const syncAsAsync = await outcome(
    A.ipcRenderer.invoke(WIRE.pageAsks.channel, { channel: 'deckit-shell:setup', payload: {} })
);
check('a channel asked at once is refused otherwise', syncAsAsync.value?.error?.kind === 'REFUSED', syncAsAsync);

// A page tells main.
inA.tell.send({ a: 'told' });
inA.tell.send({ a: 2 });
await tick();
check('main hears what a page tells, and only what fits', JSON.stringify(told) === '[["A","told"]]', told);

// Main asks a page before the page says how to answer: the question waits for it.
const early = outcome(inMain.escape.invoke(A.webContents, { key: 'Escape' }, { timeout: 1000 }));
await tick();
// Page B answers A's question: not its answer.
B.ipcRenderer.send(WIRE.pageAnswers.channel, { channel: 'deckit-shell:escape', id: 1, value: 'from B' });
await tick();
inA.escape.handle((payload) => `A took ${payload.key}`);
const answered = await early;
check('a question asked before the page answers waits for it', answered.value === 'A took Escape', answered);

// One asked with a time is kept no longer than main waits.
const timed = outcome(inMain.escape.invoke(B.webContents, {}, { timeout: 30 }));
await later(60);
const timedOut = await timed;
const before = answers.length;
inB.escape.handle(() => 'late');
await tick();
check('a question main gave up on is dropped', !!timedOut.error && answers.length === before, { timedOut, answers });

// A page gone rejects what it was asked.
const gone = outcome(inMain.escape.invoke(C.webContents, {}));
await tick();
C.webContents.emit('did-navigate');
check('a page gone rejects what it was asked', /gone/.test((await gone).error || ''), await gone);

// What main tells a page before it listens is not kept.
inMain.state.send(A.webContents, { n: 1 });
await tick();
const states = [];
inA.state.on((payload) => states.push(payload.n));
inMain.state.send(A.webContents, { n: 2 });
await tick();
check('a page hears what main tells once it listens, and nothing before', JSON.stringify(states) === '[2]', states);

// A layer's names are its own.
const own = (() => {
    try {
        MAIN.layerChannels.bind(CHANNEL.pageToMain('deckit-electron:mod-load', {}));
        return 'bound';
    } catch (error) {
        return error.message;
    }
})();
check("a layer binds no name of deckit-electron's", /not a layer's/.test(own), own);
const twice = (() => {
    try {
        CHANNEL.bindAll(MAIN.layerChannels, {
            ask: CHANNEL.pageToMain('deckit-shell:ask', {}, { reply: true }),
        }).ask.handle(() => 0);
        return 'bound';
    } catch (error) {
        return error.message;
    }
})();
check('a channel is declared once', /declared already/.test(twice), twice);
const bad = (() => {
    try {
        MAIN.layerChannels.bind({ channel: 'deckit-shell:bad', to: 'page', reply: true, sync: true });
        return 'bound';
    } catch (error) {
        return error.message;
    }
})();
check('a declaration that says nothing sound is refused', /at once/.test(bad), bad);

for (const line of failed) console.error(line);
if (failed.length) {
    console.error(`${failed.length} of ${count} channel checks failed`);
    process.exit(1);
}
console.log(`ok: ${count} channel checks`);
