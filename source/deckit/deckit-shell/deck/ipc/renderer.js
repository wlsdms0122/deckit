// Channels between main and a page, a page's side: every one crosses as a message carrying its channel's name, which
// the environment carries (environment/: PAGE.messages). `ownChannels` binds deck's own, and `layerChannels`, handed to
// a layer on deck, binds the layer's.
import * as LISTENER from '../listener/index.js';
import * as TABLE from './index.js';

// MARK: - Property
const table = TABLE.createTable({ toMain, toPage });
let messages = null; // what carries the channels, once it is handed over
// What main asked before the page said how to answer: channel -> Map(id -> { payload, timer }). Each is kept only
// while main waits for it.
const waiting = new Map();

// MARK: - Initializer
// MARK: - Public
const { ownChannels, layerChannels } = table;

// What carries the channels from now on, handed over once, as the page starts and before its code runs, so a question
// main asks a page waits here from the page's start for the page's code to say how to answer it.
function carry(environment) {
    if (messages) throw new Error('[deckit] the channels are carried already');
    messages = environment.messages;
    messages.listen({ told, asked });
}

// MARK: - Private
function carried() {
    if (!messages) throw new Error('[deckit] nothing carries the channels yet');
    return messages;
}

function toMain(copy) {
    const { channel, reply, sync } = copy;
    if (!reply) return { send: (payload = {}) => carried().tell({ channel, payload }) };
    if (sync) return { invoke: (payload = {}) => TABLE.unwrap(carried().askSync({ channel, payload })) };
    return { invoke: (payload = {}) => carried().ask({ channel, payload }).then(TABLE.unwrap) };
}

function toPage(copy) {
    const { channel, reply } = copy;
    if (!reply) return { on: (listener) => table.hear(copy).listeners.push(LISTENER.wrap(listener, channel)) };
    return {
        handle(answer) {
            const entry = table.answerWith(copy, answer);
            for (const [id, { payload, timer }] of waiting.get(channel) || []) {
                clearTimeout(timer);
                answerMain(entry, id, payload);
            }
            waiting.delete(channel);
        },
    };
}

// What main tells a page before the page listens is not kept: a page reads what is so as it starts, and what main
// told before would come after that.
function told({ channel, payload } = {}) {
    const entry = table.heardOf(channel);
    if (entry?.copy.to !== 'page' || entry.copy.reply) return;
    for (const listener of entry.listeners) listener(payload);
}

function asked({ channel, id, payload, timeout = 0 } = {}) {
    const entry = table.heardOf(channel);
    if (entry?.answer) return answerMain(entry, id, payload);
    if (entry) return send(channel, id, { error: { message: `${channel} is not asked of a page`, kind: null } });
    // Kept no longer than main waits for it: a page gone takes it along, and a question with a time runs out.
    if (!waiting.has(channel)) waiting.set(channel, new Map());
    const timer = timeout ? setTimeout(() => waiting.get(channel)?.delete(id), timeout) : null;
    waiting.get(channel).set(id, { payload, timer });
}

function answerMain(entry, id, payload) {
    TABLE.settle(() => entry.answer(payload)).then((result) => send(entry.copy.channel, id, result));
}

// An answer that cannot cross a process goes back as the error it is, so the question is not left open.
function send(channel, id, result) {
    try {
        carried().answer({ channel, id, ...result });
    } catch (error) {
        carried().answer({ channel, id, error: TABLE.errorOf(error) });
    }
}

export { ownChannels, layerChannels, carry };
