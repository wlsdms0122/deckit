// The channels between main and a page (deckit-electron/deck/ipc), checked over a stand-in for Electron's IPC: main
// and pages, each its own copy of the channels' module, as each is its own bundle. Exits 1 with a line for each check
// that failed. What a page is asked before its code says how to answer cannot be timed in the app, so it is checked
// here. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const DECKIT = path.join(__dirname, '..', '..', 'deckit');
const url = (...parts) => pathToFileURL(path.join(DECKIT, ...parts)).href;
const ROUTER = url('deckit-electron', 'deck', 'ipc', 'index.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const outcome = (promise) =>
    promise.then(
        (value) => ({ value }),
        (error) => ({ error: error.message, kind: error.kind ?? null })
    );
const thrown = (work) => {
    try {
        work();
        return '';
    } catch (error) {
        return error.message;
    }
};

// Electron's IPC, as the channels use it: what crosses is cloned and arrives on a later turn.
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
const answers = []; // every answer a page sent

function pageNamed(name, WIRE) {
    const heard = new Map();
    const events = new Map();
    const webContents = {
        name,
        destroyed: false,
        crashed: false,
        send(channel, message) {
            const copy = structuredClone(message);
            setImmediate(() => (heard.get(channel) || []).forEach((listener) => listener({}, copy)));
        },
        isDestroyed: () => webContents.destroyed,
        isCrashed: () => webContents.crashed,
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
        // Main sets returnValue once it has the answer, which the check waits for.
        sendSync(channel, message) {
            const event = { sender: webContents };
            ipcMain.listeners.get(channel).forEach((listener) => listener(event, structuredClone(message)));
            return event;
        },
    };
    return { webContents, ipcRenderer };
}

async function main() {
    const CHANNEL = await import(url('deckit-driver', 'channel', 'index.js'));
    const WIRE = await import(url('deckit-electron', 'deck', 'ipc', 'protocol.js'));
    const LISTENER = await import(url('deckit-electron', 'deck', 'listener', 'index.js'));
    const reported = [];
    LISTENER.reportTo((label) => reported.push(label));
    const routerIn = async (side, type, electron) => {
        process.type = type;
        globalThis.require = () => electron;
        return import(`${ROUTER}?${side}`);
    };
    const [A, B, C, D] = ['A', 'B', 'C', 'D'].map((name) => pageNamed(name, WIRE));
    const MAIN = await routerIn('main', 'browser', { ipcMain });
    // One at a time: each reads what it runs in as it loads.
    const pages = [];
    for (const [at, { ipcRenderer }] of [A, B, C, D].entries())
        pages.push(await routerIn(`page${at}`, 'renderer', { ipcRenderer }));
    const [PAGE_A, PAGE_B, PAGE_C, PAGE_D] = pages;

    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const DECLARED = {
        setup: CHANNEL.pageToMain('deckit-shell:setup', { a: 'string?' }, { reply: true, sync: true }),
        ask: CHANNEL.pageToMain('deckit-shell:ask', { a: 'string' }, { reply: true }),
        tell: CHANNEL.pageToMain('deckit-shell:tell', { a: 'string' }),
        escape: CHANNEL.mainToPage('deckit-shell:escape', { reply: true }),
        state: CHANNEL.mainToPage('deckit-shell:state'),
    };
    const inMain = CHANNEL.bindAll(MAIN.layerChannels, DECLARED);
    const [inA, inB, inC, inD] = [PAGE_A, PAGE_B, PAGE_C, PAGE_D].map((page) =>
        CHANNEL.bindAll(page.layerChannels, DECLARED)
    );
    // Answered with a promise, so a page asking sync waits for it to settle.
    inMain.setup.handle((payload, sender) => later(5).then(() => ({ from: sender.name, payload })));
    inMain.ask.handle((payload, sender) => ({ from: sender.name, payload }));
    const told = [];
    inMain.tell.on(() => {
        throw new Error('a listener throws');
    });
    inMain.tell.on((payload, sender) => told.push([sender.name, payload.a]));

    // A page asks main, sync and not.
    const asked = await outcome(inA.ask.invoke({ a: 'hi' }));
    check('a page asks main', asked.value?.from === 'A' && asked.value.payload.a === 'hi', asked);
    const refused = await outcome(inA.ask.invoke({ a: 1 }));
    check("main refuses what is not the channel's fields", refused.kind === 'REFUSED', refused);
    const atOnce = A.ipcRenderer.sendSync(WIRE.pageAsksSync.channel, { channel: 'deckit-shell:setup', payload: {} });
    check('a page asking sync waits for a promise to settle', atOnce.returnValue === undefined, atOnce.returnValue);
    await later(20);
    check('a page asks main sync', atOnce.returnValue?.value?.from === 'A', atOnce.returnValue);
    const notAtOnce = A.ipcRenderer.sendSync(WIRE.pageAsksSync.channel, {
        channel: 'deckit-shell:ask',
        payload: { a: 'x' },
    });
    await tick();
    check('a channel not sync is refused when asked sync', notAtOnce.returnValue?.error?.kind === 'REFUSED', notAtOnce);
    const otherwise = await A.ipcRenderer.invoke(WIRE.pageAsks.channel, { channel: 'deckit-shell:setup', payload: {} });
    check('a sync channel is refused when asked otherwise', otherwise?.error?.kind === 'REFUSED', otherwise);

    // A page tells main; a listener's throw is reported, and the others still hear.
    inA.tell.send({ a: 'told' });
    inA.tell.send({ a: 2 });
    await tick();
    check('main hears what a page tells, and only what fits', JSON.stringify(told) === '[["A","told"]]', told);
    check("a listener's throw is reported", reported.includes('deckit-shell:tell'), reported);

    // Main asks a page before the page says how to answer: the question waits for it.
    const early = outcome(inMain.escape.invoke(A.webContents, { key: 'Escape' }, { timeout: 1000 }));
    await tick();
    // Page B answers A's question: not its answer.
    B.ipcRenderer.send(WIRE.pageAnswers.channel, { channel: 'deckit-shell:escape', id: 1, value: 'from B' });
    await tick();
    inA.escape.handle((payload) => `A took ${payload.key}`);
    const answered = await early;
    check('a question asked before the page answers waits for it', answered.value === 'A took Escape', answered);
    check('a page answers once', thrown(() => inA.escape.handle(() => 0)).includes('answered already'), '');
    check('main answers once', thrown(() => inMain.ask.handle(() => 0)).includes('answered already'), '');

    // A page's error crosses with its kind.
    inD.escape.handle(() => {
        throw Object.assign(new Error('not now'), { kind: 'BUSY' });
    });
    const busy = await outcome(inMain.escape.invoke(D.webContents, {}));
    check("a page's error crosses with its kind", busy.error === 'not now' && busy.kind === 'BUSY', busy);

    // One asked with a time is kept no longer than main waits.
    const timed = outcome(inMain.escape.invoke(B.webContents, {}, { timeout: 30 }));
    await later(60);
    const timedOut = await timed;
    const before = answers.length;
    inB.escape.handle(() => 'late');
    await tick();
    check('a question main gave up on is dropped', !!timedOut.error && answers.length === before, timedOut);

    // A page gone, crashed or destroyed rejects what it was asked.
    const navigated = outcome(inMain.escape.invoke(C.webContents, {}));
    await tick();
    C.webContents.emit('did-navigate');
    check(
        'a page navigated away rejects what it was asked',
        /gone/.test((await navigated).error || ''),
        await navigated
    );
    const crashing = outcome(inMain.escape.invoke(C.webContents, {}));
    await tick();
    C.webContents.emit('render-process-gone');
    check('a page that crashes rejects what it was asked', /gone/.test((await crashing).error || ''), await crashing);
    C.webContents.destroyed = true;
    const destroyed = await outcome(inMain.escape.invoke(C.webContents, {}));
    check('a page destroyed is not asked', /gone/.test(destroyed.error || ''), destroyed);

    // What main tells a page before it listens is not kept.
    inMain.state.send(A.webContents, { n: 1 });
    await tick();
    const states = [];
    inA.state.on((payload) => states.push(payload.n));
    inMain.state.send(A.webContents, { n: 2 });
    await tick();
    check('a page hears what main tells once it listens, and nothing before', JSON.stringify(states) === '[2]', states);

    // A layer's names are its own, read once.
    const own = thrown(() => MAIN.layerChannels.bind(CHANNEL.pageToMain('deckit-electron:mod-load', {})));
    check("a layer binds no name of deckit-electron's", /not a layer's/.test(own), own);
    let reads = 0;
    const twoFaced = {
        get channel() {
            return ++reads === 1 ? 'deckit-shell:mask' : 'deckit-electron:mod-load';
        },
        to: 'main',
        fields: {},
        reply: true,
        sync: false,
    };
    const masked = thrown(() => MAIN.layerChannels.bind(twoFaced));
    check('a declaration is read once, so what is checked is what is bound', masked === '' && reads === 1, {
        masked,
        reads,
    });
    for (const [side, router] of [
        ['main', MAIN],
        ['a page', PAGE_A],
    ]) {
        const other = thrown(() =>
            router.layerChannels.bind(CHANNEL.pageToMain('deckit-shell:ask', {}, { reply: true }))
        );
        check(`a channel is declared once, in ${side}`, /declared already/.test(other), other);
        const again = thrown(() => router.layerChannels.bind(DECLARED.ask));
        check(`binding the same declaration again binds it, in ${side}`, again === '', again);
    }
    const unsound = thrown(() =>
        MAIN.layerChannels.bind({ channel: 'deckit-shell:bad', to: 'page', reply: true, sync: true })
    );
    check('a declaration that says nothing sound is refused', /sync/.test(unsound), unsound);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} channel checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} channel checks`);
}

main().catch((error) => {
    console.error('[channels] ' + (error.stack || error.message));
    process.exit(1);
});
