// Channels between main and a page, carried by Electron's IPC: every one crosses over the few in protocol.js, each
// message carrying its channel's name. `ownChannels` binds deckit-electron's own, and `layerChannels`, handed to a
// layer on deck, binds the layer's.
import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as WIRE from './protocol.js';
import * as LISTENER from '../listener/index.js';

// MARK: - Property
const electron = require('electron');
const inMain = process.type === 'browser';
// The names deckit-electron's channels start with, as its wire's do: a layer's never do.
const OWN = WIRE.pageTells.channel.slice(0, WIRE.pageTells.channel.indexOf(':') + 1);
const declared = new Map(); // channel -> the declaration it was bound as, so it is declared once
// The channels heard here, by name: { copy, answer, listeners }, once something answers or listens on one.
const heard = new Map();
// In main, what a page was asked and has not answered: channel -> Map(id -> { resolve, reject, webContents, timer }).
const asked = new Map();
const watched = new WeakSet(); // webContents whose page going away rejects what was asked of it
let sequence = 0;
// In a page, what main asked before the page said how to answer: channel -> Map(id -> { payload, timer }). Each is
// kept only while main waits for it.
const waiting = new Map();

// MARK: - Initializer
// Heard as the bundle loads, so a question main asks a page waits there from the page's start for the page's code
// to say how to answer it.
if (inMain) listenInMain();
else listenInPage();

// MARK: - Public
// A channel as deckit-driver declares it, carried over the channels in protocol.js: on main's side `handle` or `on`
// for what a page asks or tells, `invoke` or `send` for what main asks or tells a page; on a page's side the other
// way. What is bound is a copy of the declaration, read once, so nothing changes it after. A channel is declared
// once: binding the same declaration again binds the same channel, and another declaration of its name is refused.
function bindOwn(given) {
    return bindCopy(given, copyOf(given));
}

// A layer's on deck, bound as any other, but never under a name of deckit-electron's.
function bindLayer(given) {
    const copy = copyOf(given);
    if (copy.channel.startsWith(OWN)) throw new Error(`[deckit] ${copy.channel} is not a layer's to declare`);
    return bindCopy(given, copy);
}

// What deckit-electron's concepts bind their channels with, and what a layer on deck is handed for its own.
const ownChannels = Object.freeze({ bind: bindOwn });
const layerChannels = Object.freeze({ bind: bindLayer });

// MARK: - Private
function bindCopy(given, copy) {
    const known = declared.get(copy.channel);
    if (known && known !== given) throw new Error(`[deckit] ${copy.channel} is declared already`);
    declared.set(copy.channel, given);
    return Object.freeze(copy.to === 'main' ? toMain(copy) : toPage(copy));
}

// Each part of `given` read once, then checked: what is checked is what is bound.
function copyOf(given) {
    const read = given && typeof given === 'object' ? { ...given } : given;
    if (read?.fields && typeof read.fields === 'object') read.fields = { ...read.fields };
    const problem = CHANNEL.declarationProblem(read);
    if (problem) throw new Error(`[deckit] ${problem}`);
    const { channel, to, fields, reply, sync } = read;
    return to === 'main'
        ? CHANNEL.pageToMain(channel, fields, { reply, sync })
        : CHANNEL.mainToPage(channel, { reply });
}

// The channel's entry, heard from now on.
function hear(copy) {
    if (!heard.has(copy.channel)) heard.set(copy.channel, { copy, answer: null, listeners: [] });
    return heard.get(copy.channel);
}

// What answers the channel, once: a second is refused, as a second answer could not be told apart.
function answerWith(copy, answer) {
    const entry = hear(copy);
    if (entry.answer) throw new Error(`[deckit] ${copy.channel} is answered already`);
    entry.answer = answer;
    return entry;
}

function toMain(copy) {
    const { channel, reply, sync } = copy;
    if (inMain) {
        if (!reply) return { on: (listener) => hear(copy).listeners.push(LISTENER.wrap(listener, channel)) };
        return {
            handle(answer) {
                answerWith(copy, answer);
            },
        };
    }
    const { ipcRenderer } = electron;
    if (!reply) return { send: (payload = {}) => ipcRenderer.send(WIRE.pageTells.channel, { channel, payload }) };
    if (sync)
        return {
            invoke: (payload = {}) => unwrap(ipcRenderer.sendSync(WIRE.pageAsksSync.channel, { channel, payload })),
        };
    return { invoke: (payload = {}) => ipcRenderer.invoke(WIRE.pageAsks.channel, { channel, payload }).then(unwrap) };
}

function toPage(copy) {
    const { channel, reply } = copy;
    if (inMain) {
        if (reply)
            return { invoke: (webContents, payload = {}, options) => ask(webContents, channel, payload, options) };
        return {
            send(webContents, payload = {}) {
                if (!webContents.isDestroyed()) webContents.send(WIRE.mainTells.channel, { channel, payload });
            },
        };
    }
    if (!reply) return { on: (listener) => hear(copy).listeners.push(LISTENER.wrap(listener, channel)) };
    return {
        handle(answer) {
            const entry = answerWith(copy, answer);
            for (const [id, { payload, timer }] of waiting.get(channel) || []) {
                clearTimeout(timer);
                answerMain(entry, id, payload);
            }
            waiting.delete(channel);
        },
    };
}

// A page runs code main does not trust, so main holds what it says to the channel's fields; nothing else checks.
function listenInMain() {
    const { ipcMain } = electron;
    ipcMain.on(WIRE.pageTells.channel, (event, message) => {
        const problem = CHANNEL.problemOf(WIRE.pageTells, message);
        const entry = !problem && heard.get(message.channel);
        const refused =
            problem ||
            (!entry || entry.copy.to !== 'main' || entry.copy.reply
                ? `${message.channel} is not told to main`
                : CHANNEL.problemOf(entry.copy, message.payload));
        if (refused) return console.error(`[deckit] refused: ${refused}`);
        for (const listener of entry.listeners) listener(message.payload, event.sender);
    });
    ipcMain.handle(WIRE.pageAsks.channel, (event, message) => answerPage(WIRE.pageAsks, message, event.sender));
    // A page asking sync waits until main has the answer, a promise's included.
    ipcMain.on(WIRE.pageAsksSync.channel, (event, message) => {
        answerPage(WIRE.pageAsksSync, message, event.sender).then((result) => {
            event.returnValue = result;
        });
    });
    ipcMain.on(WIRE.pageAnswers.channel, (event, message) => {
        if (CHANNEL.problemOf(WIRE.pageAnswers, message)) return;
        const { channel, id, value, error } = message;
        const question = asked.get(channel)?.get(id);
        if (!question || question.webContents !== event.sender) return;
        settleAsked(channel, id, { value, error: error && errorOf(error) });
    });
}

// What main answers a page that asks over `wire`: refused when the message is not what the wire carries, the channel
// is none main answers, it is asked sync or not otherwise than it is declared, or its payload is not its fields'.
function answerPage(wire, message, sender) {
    const problem = CHANNEL.problemOf(wire, message);
    if (problem) return Promise.resolve(refusal(problem));
    const entry = heard.get(message.channel);
    if (!entry || entry.copy.to !== 'main' || !entry.copy.reply || !entry.answer)
        return Promise.resolve({ error: { message: `${message.channel} is not answered`, kind: null } });
    if (entry.copy.sync !== wire.sync)
        return Promise.resolve(refusal(`${message.channel} is ${entry.copy.sync ? '' : 'not '}asked sync`));
    const refused = CHANNEL.problemOf(entry.copy, message.payload);
    if (refused) return Promise.resolve(refusal(refused));
    return settle(() => entry.answer(message.payload, sender));
}

function listenInPage() {
    const { ipcRenderer } = electron;
    // What main tells a page before the page listens is not kept: a page reads what is so as it starts, and what main
    // told before would come after that.
    ipcRenderer.on(WIRE.mainTells.channel, (_event, { channel, payload } = {}) => {
        const entry = heard.get(channel);
        if (entry?.copy.to !== 'page' || entry.copy.reply) return;
        for (const listener of entry.listeners) listener(payload);
    });
    ipcRenderer.on(WIRE.mainAsks.channel, (_event, { channel, id, payload, timeout = 0 } = {}) => {
        const entry = heard.get(channel);
        if (entry?.answer) return answerMain(entry, id, payload);
        if (entry) return send(channel, id, { error: { message: `${channel} is not asked of a page`, kind: null } });
        // Kept no longer than main waits for it: a page gone takes it along, and a question with a time runs out.
        if (!waiting.has(channel)) waiting.set(channel, new Map());
        const timer = timeout ? setTimeout(() => waiting.get(channel)?.delete(id), timeout) : null;
        waiting.get(channel).set(id, { payload, timer });
    });
}

function answerMain(entry, id, payload) {
    settle(() => entry.answer(payload)).then((result) => send(entry.copy.channel, id, result));
}

// An answer that cannot cross a process goes back as the error it is, so the question is not left open.
function send(channel, id, result) {
    const { ipcRenderer } = electron;
    try {
        ipcRenderer.send(WIRE.pageAnswers.channel, { channel, id, ...result });
    } catch (error) {
        ipcRenderer.send(WIRE.pageAnswers.channel, { channel, id, error: errorOf(error) });
    }
}

// A question to a page is answered by that page, or rejected once it cannot be: the page is gone, crashed or
// was replaced by a navigation, or `timeout` ran out.
function ask(webContents, channel, payload, { timeout = 0 } = {}) {
    if (webContents.isDestroyed() || webContents.isCrashed())
        return Promise.reject(new Error(`${channel}: the page is gone`));
    if (!asked.has(channel)) asked.set(channel, new Map());
    watch(webContents);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        const timer = timeout
            ? setTimeout(() => settleAsked(channel, id, { error: { message: `${channel}: no answer` } }), timeout)
            : null;
        asked.get(channel).set(id, { resolve, reject, webContents, timer });
        webContents.send(WIRE.mainAsks.channel, { channel, id, payload, timeout });
    });
}

function watch(webContents) {
    if (watched.has(webContents)) return;
    watched.add(webContents);
    const end = () => {
        for (const [channel, questions] of asked) {
            for (const [id, question] of questions) {
                if (question.webContents === webContents)
                    settleAsked(channel, id, { error: { message: `${channel}: the page is gone` } });
            }
        }
    };
    // A main-frame navigation that commits replaces the page; one refused before it commits leaves it be.
    webContents.on('did-navigate', end);
    webContents.on('render-process-gone', end);
    webContents.once('destroyed', end);
}

function settleAsked(channel, id, { value, error }) {
    const question = asked.get(channel)?.get(id);
    if (!question) return;
    asked.get(channel).delete(id);
    clearTimeout(question.timer);
    if (error) question.reject(failure(error));
    else question.resolve(value);
}

// Only a message crosses a process, so an error's kind travels beside it and is put back on the far side.
function errorOf(error) {
    return { message: String(error?.message ?? error), kind: error?.kind ?? null };
}

function failure({ message, kind }) {
    return Object.assign(new Error(message), { kind });
}

function refusal(message) {
    return { error: { message, kind: 'REFUSED' } };
}

function unwrap(answer) {
    if (answer?.error) throw failure(answer.error);
    return answer?.value;
}

function settle(work) {
    return Promise.resolve()
        .then(work)
        .then(
            (value) => ({ value }),
            (error) => ({ error: errorOf(error) })
        );
}

export { ownChannels, layerChannels };
