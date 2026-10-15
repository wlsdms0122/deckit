import * as LISTENER from '../log/listener.js';

// MARK: - Property
const electron = require('electron');
const inMain = process.type === 'browser';
const pending = new Map(); // channel -> Map(id -> { resolve, reject, webContents, timer })
const watched = new WeakSet(); // webContents whose page going away rejects what was asked of it
let sequence = 0;

// MARK: - Initializer
// MARK: - Public
// A renderer runs code main does not trust, so main holds what arrives to `fields`; nothing else checks.
function rendererToMain(channel, fields, { reply = false, sync = false } = {}) {
    if (inMain) {
        if (reply) return { handle: (answer) => handle(channel, fields, sync, answer) };
        return { on: (listener) => listen(channel, fields, listener) };
    }
    const { ipcRenderer } = electron;
    if (!reply) return { send: (payload = {}) => ipcRenderer.send(channel, payload) };
    if (sync) return { invoke: (payload = {}) => unwrap(ipcRenderer.sendSync(channel, payload)) };
    return { invoke: (payload = {}) => ipcRenderer.invoke(channel, payload).then(unwrap) };
}

function mainToRenderer(channel, { reply = false } = {}) {
    if (inMain) {
        if (reply)
            return {
                invoke: (webContents, payload = {}, options) => ask(webContents, channel, payload, options),
            };
        return { send: (webContents, payload = {}) => deliver(webContents, channel, payload) };
    }
    if (!reply) return { on: (listener) => hear(channel, LISTENER.wrap(listener, channel)) };
    return questionsFor(channel);
}

// MARK: - Private
function problemOf(channel, fields, payload) {
    if (kindOf(payload) !== 'object') return `${channel} carries an object, not ${kindOf(payload)}`;
    for (const key of Object.keys(payload)) {
        if (!Object.hasOwn(fields, key)) return `${channel} has no field ${key}`;
    }
    for (const [key, written] of Object.entries(fields)) {
        const optional = written.endsWith('?');
        const type = optional ? written.slice(0, -1) : written;
        const value = payload[key];
        if (value === undefined || value === null) {
            if (!optional) return `${channel} needs ${key}`;
            continue;
        }
        if (type !== 'any' && kindOf(value) !== type) return `${channel}'s ${key} is ${kindOf(value)}, not ${type}`;
    }
    return '';
}

function kindOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// Only a message crosses a process, so an error's kind travels beside it and is put back on the far side.
function errorOf(error) {
    return { message: String(error?.message ?? error), kind: error?.kind ?? null };
}

function failure({ message, kind }) {
    return Object.assign(new Error(message), { kind });
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

function handle(channel, fields, sync, answer) {
    const { ipcMain } = electron;
    if (!sync) {
        ipcMain.handle(channel, (event, payload) => {
            const problem = problemOf(channel, fields, payload);
            if (problem) return { error: { message: problem, kind: 'REFUSED' } };
            return settle(() => answer(payload, event.sender));
        });
        return;
    }
    // A synchronous answer is what the handler returns at once: a promise cannot cross.
    ipcMain.on(channel, (event, payload) => {
        const problem = problemOf(channel, fields, payload);
        if (problem) {
            event.returnValue = { error: { message: problem, kind: 'REFUSED' } };
            return;
        }
        try {
            event.returnValue = { value: answer(payload, event.sender) };
        } catch (error) {
            event.returnValue = { error: errorOf(error) };
        }
    });
}

function listen(channel, fields, listener) {
    const guarded = LISTENER.wrap(listener, channel);
    electron.ipcMain.on(channel, (event, payload) => {
        const problem = problemOf(channel, fields, payload);
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

// A question to a page is answered by that page, or rejected once it cannot be: the page is gone, crashed or
// was replaced by a navigation, or `timeout` ran out.
function ask(webContents, channel, payload, { timeout = 0 } = {}) {
    if (!pending.has(channel)) hearAnswers(channel);
    if (webContents.isDestroyed() || webContents.isCrashed())
        return Promise.reject(new Error(`${channel}: the page is gone`));
    watch(webContents);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        const timer = timeout
            ? setTimeout(() => settleAsked(channel, id, { error: { message: `${channel}: no answer` } }), timeout)
            : null;
        pending.get(channel).set(id, { resolve, reject, webContents, timer });
        webContents.send(channel, { id, payload });
    });
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
    const asked = pending.get(channel).get(id);
    if (!asked) return;
    pending.get(channel).delete(id);
    clearTimeout(asked.timer);
    if (error) asked.reject(failure(error));
    else asked.resolve(value);
}

function hearAnswers(channel) {
    pending.set(channel, new Map());
    electron.ipcMain.on(channel + ':answer', (event, answer) => {
        const asked = pending.get(channel).get(answer?.id);
        if (!asked || asked.webContents !== event.sender) return;
        settleAsked(channel, answer.id, { value: answer.value, error: answer.error && errorOf(answer.error) });
    });
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

export { rendererToMain, mainToRenderer };
// Where the listeners of the bundle that carries this report what they throw: a layer's bundle carries its own.
export { reportTo } from '../log/listener.js';
