// Channels between main and a page, main's side: every one crosses as a message carrying its channel's name, which the
// environment carries (environment/: MAIN.messages). `ownChannels` binds deck's own, and `layerChannels`, handed to a
// layer on deck, binds the layer's.
import * as CHANNEL from '../channel/index.js';
import * as LISTENER from '../listener/index.js';
import * as ENVELOPE from './model/envelope.js';
import * as TABLE from './index.js';

// MARK: - Property
const table = TABLE.createTable({ toMain, toPage });
// What carries the channels, once it is handed over: { messages, pages } of the environment.
let carrier = null;
// What a page was asked and has not answered: channel -> Map(id -> { resolve, reject, page, timer }).
const asked = new Map();
const watched = new WeakSet(); // pages whose document going rejects what was asked of them
let sequence = 0;

// MARK: - Initializer
// MARK: - Public
const { ownChannels, layerChannels } = table;

// What carries the channels from now on, handed over once, before anything crosses: a channel is bound as its module
// loads, and heard once something carries it.
function carry(environment) {
    if (carrier) throw new Error('[deckit] the channels are carried already');
    carrier = environment;
    carrier.messages.listen({
        told,
        asked: (page, message) => answerPage(ENVELOPE.asked, message, page),
        askedSync: (page, message) => answerPage(ENVELOPE.askedSync, message, page),
        answered,
    });
}

// MARK: - Private
function carried() {
    if (!carrier) throw new Error('[deckit] nothing carries the channels yet');
    return carrier;
}

function toMain(copy) {
    const { channel, reply } = copy;
    if (!reply) return { on: (listener) => table.hear(copy).listeners.push(LISTENER.wrap(listener, channel)) };
    return {
        handle(answer) {
            table.answerWith(copy, answer);
        },
    };
}

function toPage(copy) {
    const { channel, reply } = copy;
    if (reply) return { invoke: (page, payload = {}, options) => ask(page, channel, payload, options) };
    return {
        send(page, payload = {}) {
            carried().messages.tell(page, { channel, payload });
        },
    };
}

// A page runs code main does not trust, so main holds what it says to the channel's fields; nothing else checks.
function told(page, message) {
    const problem = CHANNEL.problemOf(ENVELOPE.told, message);
    const entry = !problem && table.heardOf(message.channel);
    const refused =
        problem ||
        (!entry || entry.copy.to !== 'main' || entry.copy.reply
            ? `${message.channel} is not told to main`
            : CHANNEL.problemOf(entry.copy, message.payload));
    if (refused) return console.error(`[deckit] refused: ${refused}`);
    for (const listener of entry.listeners) listener(message.payload, page);
}

// What main answers a page that asks as `envelope` says: refused when the message is not what it carries, the channel
// is none main answers, it is asked sync or not otherwise than it is declared, or its payload is not its fields'.
function answerPage(envelope, message, page) {
    const problem = CHANNEL.problemOf(envelope, message);
    if (problem) return Promise.resolve(TABLE.refusal(problem));
    const entry = table.heardOf(message.channel);
    if (!entry || entry.copy.to !== 'main' || !entry.copy.reply || !entry.answer)
        return Promise.resolve({ error: { message: `${message.channel} is not answered`, kind: null } });
    if (entry.copy.sync !== envelope.sync)
        return Promise.resolve(TABLE.refusal(`${message.channel} is ${entry.copy.sync ? '' : 'not '}asked sync`));
    const refused = CHANNEL.problemOf(entry.copy, message.payload);
    if (refused) return Promise.resolve(TABLE.refusal(refused));
    return TABLE.settle(() => entry.answer(message.payload, page));
}

// A page's answer counts only from the page that was asked.
function answered(page, message) {
    if (CHANNEL.problemOf(ENVELOPE.answer, message)) return;
    const { channel, id, value, error } = message;
    const question = asked.get(channel)?.get(id);
    if (!question || question.page !== page) return;
    settleAsked(channel, id, { value, error: error && TABLE.errorOf(error) });
}

// A question to a page is answered by that page, or rejected once it cannot be: the page is gone, crashed or
// was replaced by a navigation, or `timeout` ran out.
function ask(page, channel, payload, { timeout = 0 } = {}) {
    const { messages, pages } = carried();
    if (pages.isGone(page)) return Promise.reject(new Error(`${channel}: the page is gone`));
    if (!asked.has(channel)) asked.set(channel, new Map());
    watch(page);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        const timer = timeout
            ? setTimeout(() => settleAsked(channel, id, { error: { message: `${channel}: no answer` } }), timeout)
            : null;
        asked.get(channel).set(id, { resolve, reject, page, timer });
        messages.ask(page, { channel, id, payload, timeout });
    });
}

function watch(page) {
    if (watched.has(page)) return;
    watched.add(page);
    const end = () => {
        for (const [channel, questions] of asked) {
            for (const [id, question] of questions) {
                if (question.page === page)
                    settleAsked(channel, id, { error: { message: `${channel}: the page is gone` } });
            }
        }
    };
    carried().pages.watch(page, { ended: end, destroyed: end });
}

function settleAsked(channel, id, { value, error }) {
    const question = asked.get(channel)?.get(id);
    if (!question) return;
    asked.get(channel).delete(id);
    clearTimeout(question.timer);
    if (error) question.reject(TABLE.failure(error));
    else question.resolve(value);
}

export { ownChannels, layerChannels, carry };
