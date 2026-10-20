import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as LISTENER from '../listener/index.js';

// MARK: - Property
const electron = require('electron');
const inMain = process.type === 'browser';
const bound = new Map(); // channel -> { declared, endpoint }: one endpoint for each channel in this bundle
const pending = new Map(); // channel -> Map(id -> { resolve, reject, webContents, timer })
const watched = new WeakSet(); // webContents whose page going away rejects what was asked of it
let sequence = 0;

// MARK: - Initializer
// MARK: - Public
// A channel as deckit-driver declares it, carried by Electron's IPC under its own name: on main's side `handle` or
// `on` for what a page asks or tells, `invoke` or `send` for what main asks or tells a page; on a page's side the other
// way. A channel is declared once: binding it again answers what the first binding did, for the same declaration,
// and is refused for another. What is bound is a copy of the declaration, so nothing changes it after.
function bind(declared) {
    const known = bound.get(declared?.channel);
    if (known) {
        if (known.declared !== declared) throw new Error(`[deckit] ${declared.channel} is declared already`);
        return known.endpoint;
    }
    const copy = copyOf(declared);
    const endpoint = Object.freeze(copy.to === 'main' ? toMain(copy) : toPage(copy));
    bound.set(copy.channel, { declared, endpoint });
    return endpoint;
}

// Whether `channel` is bound here under its own name.
function isBound(channel) {
    return bound.has(channel);
}

// A declaration as deckit-driver makes it, rebuilt from what it says, or a throw saying why it is none.
function copyOf(declared) {
    const problem = CHANNEL.declarationProblem(declared);
    if (problem) throw new Error(`[deckit] ${problem}`);
    const { channel, to, fields, reply, sync } = declared;
    return to === 'main'
        ? CHANNEL.pageToMain(channel, fields, { reply, sync })
        : CHANNEL.mainToPage(channel, { reply });
}

// A question to a page is answered by that page, or rejected once it cannot be: the page is gone, crashed or
// was replaced by a navigation, or `timeout` ran out. `post(webContents, { id, payload })` puts it to the page, and
// `answered` settles it.
function ask(webContents, channel, payload, { timeout = 0 } = {}, post) {
    if (!pending.has(channel)) pending.set(channel, new Map());
    if (webContents.isDestroyed() || webContents.isCrashed())
        return Promise.reject(new Error(`${channel}: the page is gone`));
    watch(webContents);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        const timer = timeout
            ? setTimeout(() => settleAsked(channel, id, { error: { message: `${channel}: no answer` } }), timeout)
            : null;
        pending.get(channel).set(id, { resolve, reject, webContents, timer });
        post(webContents, { id, payload });
    });
}

// The answer `sender` gave to question `id` on `channel`: `{ value }` or `{ error }`. One from another page is not
// its answer.
function answered(channel, id, sender, { value, error }) {
    const asked = pending.get(channel)?.get(id);
    if (!asked || asked.webContents !== sender) return;
    settleAsked(channel, id, { value, error: error && errorOf(error) });
}

// What `work` came to, as it crosses a process: `{ value }`, or `{ error }` with its kind beside its message.
function settle(work) {
    return Promise.resolve()
        .then(work)
        .then(
            (value) => ({ value }),
            (error) => ({ error: errorOf(error) })
        );
}

function errorOf(error) {
    return { message: String(error?.message ?? error), kind: error?.kind ?? null };
}

// MARK: - Private
// A page runs code main does not trust, so main holds what arrives to the declaration's fields; nothing else checks.
function toMain(declared) {
    const { channel, reply, sync } = declared;
    if (inMain) {
        if (reply) return { handle: (answer) => handle(declared, answer) };
        return { on: (listener) => listen(declared, listener) };
    }
    const { ipcRenderer } = electron;
    if (!reply) return { send: (payload = {}) => ipcRenderer.send(channel, payload) };
    if (sync) return { invoke: (payload = {}) => unwrap(ipcRenderer.sendSync(channel, payload)) };
    return { invoke: (payload = {}) => ipcRenderer.invoke(channel, payload).then(unwrap) };
}

function toPage({ channel, reply }) {
    if (inMain) {
        if (reply)
            return {
                invoke: (webContents, payload = {}, options) => {
                    if (!pending.has(channel)) hearAnswers(channel);
                    return ask(webContents, channel, payload, options, (page, question) =>
                        page.send(channel, question)
                    );
                },
            };
        return { send: (webContents, payload = {}) => deliver(webContents, channel, payload) };
    }
    if (!reply) return { on: (listener) => hear(channel, LISTENER.wrap(listener, channel)) };
    return questionsFor(channel);
}

// Only a message crosses a process, so an error's kind travels beside it (errorOf) and is put back on the far side.
function failure({ message, kind }) {
    return Object.assign(new Error(message), { kind });
}

function unwrap(answer) {
    if (answer?.error) throw failure(answer.error);
    return answer?.value;
}

function handle(declared, answer) {
    const { channel, sync } = declared;
    const { ipcMain } = electron;
    if (!sync) {
        ipcMain.handle(channel, (event, payload) => {
            const problem = CHANNEL.problemOf(declared, payload);
            if (problem) return { error: { message: problem, kind: 'REFUSED' } };
            return settle(() => answer(payload, event.sender));
        });
        return;
    }
    // The page waits for a synchronous answer until main has it, a promise's included.
    ipcMain.on(channel, (event, payload) => {
        const problem = CHANNEL.problemOf(declared, payload);
        if (problem) {
            event.returnValue = { error: { message: problem, kind: 'REFUSED' } };
            return;
        }
        settle(() => answer(payload, event.sender)).then((result) => {
            event.returnValue = result;
        });
    });
}

function listen(declared, listener) {
    const { channel } = declared;
    const guarded = LISTENER.wrap(listener, channel);
    electron.ipcMain.on(channel, (event, payload) => {
        const problem = CHANNEL.problemOf(declared, payload);
        if (problem) {
            console.error(`[deckit] refused: ${problem}`);
            return;
        }
        guarded(payload, event.sender);
    });
}

function deliver(webContents, channel, payload) {
    if (webContents.isDestroyed()) return;
    webContents.send(channel, payload);
}

function watch(webContents) {
    if (watched.has(webContents)) return;
    watched.add(webContents);
    const end = () => {
        for (const [channel, waiting] of pending) {
            for (const [id, asked] of waiting) {
                if (asked.webContents === webContents)
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
    const asked = pending.get(channel)?.get(id);
    if (!asked) return;
    pending.get(channel).delete(id);
    clearTimeout(asked.timer);
    if (error) asked.reject(failure(error));
    else asked.resolve(value);
}

function hearAnswers(channel) {
    pending.set(channel, new Map());
    electron.ipcMain.on(channel + ':answer', (event, answer) =>
        answered(channel, answer?.id, event.sender, answer || {})
    );
}

function hear(channel, listener) {
    electron.ipcRenderer.on(channel, (_event, payload) => listener(payload));
}

// Heard from the moment the page declares the channel: a question that arrives before the page's code says how
// to answer it waits for that, and is not lost.
function questionsFor(channel) {
    const { ipcRenderer } = electron;
    const waiting = [];
    let answer = null;
    ipcRenderer.on(channel, (_event, question) => (answer ? reply(question) : waiting.push(question)));
    function reply({ id, payload }) {
        settle(() => answer(payload)).then((result) => {
            // An answer that cannot cross a process goes back as the error it is, so the question is not left open.
            try {
                ipcRenderer.send(channel + ':answer', { id, ...result });
            } catch (error) {
                ipcRenderer.send(channel + ':answer', { id, error: errorOf(error) });
            }
        });
    }
    return {
        handle(given) {
            answer = given;
            for (const question of waiting.splice(0)) reply(question);
        },
    };
}

export { bind, isBound, copyOf, ask, answered, settle, errorOf };
