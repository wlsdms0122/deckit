// What carries what crosses between this page and main, on the page's side (protocol.js), and deck's messages over it
// (deckit-shell/environment: PAGE.messages). What main tells is heard once something listens on its channel. Taken as
// the preload starts, before any mod's code runs.
import * as WIRE from './protocol.js';

// MARK: - Property
const handler = window.webkit.messageHandlers[WIRE.HANDLER];
const Request = XMLHttpRequest;
const heard = new Map(); // channel -> listener(body)
const documentId = crypto.randomUUID(); // this document's, as main counts what it sent
let posts = 0;
Object.defineProperty(globalThis, Symbol.for(WIRE.TOLD), {
    value: ({ channel, body }) => heard.get(channel)?.(body),
});

// MARK: - Initializer
// MARK: - Public
// Throws at once when `body` cannot be carried.
function post(channel, body) {
    const text = JSON.stringify({ channel, body, document: documentId });
    handler.postMessage(text);
    posts++;
}

// What main answers, a promise of it, or the answer itself with `sync`, the page held until main has it.
function request(channel, body, { sync = false } = {}) {
    const sent = JSON.stringify({ channel, body, document: documentId, after: posts });
    if (sync) return answerOf(send(sent, false));
    return new Promise((resolve, reject) => {
        const request = send(sent, true, () => {
            try {
                resolve(answerOf(request));
            } catch (error) {
                reject(error);
            }
        });
    });
}

// `listener(body)` hears what main tells on `channel`, once.
function on(channel, listener) {
    if (heard.has(channel)) throw new Error(`[deckit] ${channel} is heard already`);
    heard.set(channel, listener);
}

let listening = false;
function listen({ told }) {
    if (listening) throw new Error('[deckit] main is heard already');
    listening = true;
    on(WIRE.CHANNEL.deckTell, told);
}

const messages = Object.freeze({
    listen,
    tell: (message) => post(WIRE.CHANNEL.deckTell, message),
    ask: (message) => request(WIRE.CHANNEL.deckAsk, message),
    askSync: (message) => request(WIRE.CHANNEL.deckAskSync, message, { sync: true }),
});

// MARK: - Private
function send(text, async, done = null) {
    const request = new Request();
    request.open('POST', '/', async);
    if (done) request.onloadend = done;
    request.send(text);
    return request;
}

function answerOf(request) {
    const answer = JSON.parse(request.responseText || '{}');
    if (request.status !== 200) throw new Error(answer.error || `main did not answer (${request.status})`);
    return answer.value;
}

export { post, request, on, messages };
export { CHANNEL } from './protocol.js';
