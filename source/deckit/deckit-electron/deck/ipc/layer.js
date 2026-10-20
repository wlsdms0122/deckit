import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as BIND from './bind.js';
import * as DECLARED from './protocol.js';
import * as LISTENER from '../listener/index.js';

// MARK: - Property
const inMain = process.type === 'browser';
const PROTOCOL = CHANNEL.bindAll(BIND, DECLARED);
const bound = new Map(); // channel -> { declared, endpoint }, of the layers' channels in this bundle
// In main: what answers and what hears each channel.
const answers = new Map(); // channel -> { declared, answer }
const hearers = new Map(); // channel -> { declared, listeners }
// In a page: what main asked before the page said how to answer, and what hears what main tells.
const waiting = new Map(); // channel -> [{ id, payload }]
const answering = new Map(); // channel -> answer
const listening = new Map(); // channel -> Set(listener)

// MARK: - Initializer
// Heard as the bundle loads: in main before a layer binds, and in a page from its start, so a question main asks a
// page waits there for the page's code to say how to answer it.
if (inMain) {
    PROTOCOL.told.on(({ channel, payload }, sender) => hear(channel, payload, sender));
    PROTOCOL.asked.handle(({ channel, payload }, sender) => respond(channel, payload, sender));
    PROTOCOL.askedAtOnce.handle(({ channel, payload }, sender) => respond(channel, payload, sender));
    PROTOCOL.answer.on(({ channel, id, value, error }, sender) => BIND.answered(channel, id, sender, { value, error }));
} else {
    PROTOCOL.toPage.on(({ channel, id = null, payload = {} }) =>
        id === null ? heard(channel, payload) : asked(channel, { id, payload })
    );
}

// MARK: - Public
// A layer's own channel, declared as any is (deckit-driver/channel), carried over the channels in protocol.js and
// answering as a channel bound under its own name does (bind.js). Its name is the layer's: none bound under its own
// name here, and none ending `:answer`. A channel is declared once.
function bind(declared) {
    const known = bound.get(declared?.channel);
    if (known) {
        if (known.declared !== declared) throw new Error(`[deckit] ${declared.channel} is declared already`);
        return known.endpoint;
    }
    const copy = BIND.copyOf(declared);
    if (BIND.isBound(copy.channel) || copy.channel.endsWith(':answer'))
        throw new Error(`[deckit] ${copy.channel} is not a layer's to declare`);
    const endpoint = Object.freeze(copy.to === 'main' ? toMain(copy) : toPage(copy));
    bound.set(copy.channel, { declared, endpoint });
    return endpoint;
}

// What a layer on deck is handed to bind its own channels with.
const channels = Object.freeze({ bind });

// MARK: - Private
function toMain(declared) {
    const { channel, reply, sync } = declared;
    if (inMain) {
        if (reply)
            return {
                handle(given) {
                    if (answers.has(channel)) throw new Error(`[deckit] ${channel} is answered already`);
                    answers.set(channel, { declared, answer: given });
                },
            };
        hearers.set(channel, { declared, listeners: [] });
        return { on: (listener) => hearers.get(channel).listeners.push(LISTENER.wrap(listener, channel)) };
    }
    if (!reply) return { send: (payload = {}) => PROTOCOL.told.send({ channel, payload }) };
    const asking = sync ? PROTOCOL.askedAtOnce : PROTOCOL.asked;
    return { invoke: (payload = {}) => asking.invoke({ channel, payload }) };
}

function toPage({ channel, reply }) {
    if (inMain) {
        const post = (page, told) => PROTOCOL.toPage.send(page, { channel, ...told });
        if (reply) return { invoke: (page, payload = {}, options) => BIND.ask(page, channel, payload, options, post) };
        return { send: (page, payload = {}) => post(page, { payload }) };
    }
    if (reply)
        return {
            handle(given) {
                answering.set(channel, given);
                for (const question of waiting.get(channel)?.splice(0) || []) reply(channel, question);
            },
        };
    listening.set(channel, new Set());
    return { on: (listener) => listening.get(channel).add(LISTENER.wrap(listener, channel)) };
}

// A page runs code main does not trust, so main holds what it says to the channel's fields; nothing else checks.
function respond(channel, payload, sender) {
    const answered = answers.get(channel);
    if (!answered) throw new Error(`${channel} is not answered`);
    const problem = CHANNEL.problemOf(answered.declared, payload);
    if (problem) throw Object.assign(new Error(problem), { kind: 'REFUSED' });
    return answered.answer(payload, sender);
}

function hear(channel, payload, sender) {
    const heard = hearers.get(channel);
    if (!heard) return;
    const problem = CHANNEL.problemOf(heard.declared, payload);
    if (problem) {
        console.error(`[deckit] refused: ${problem}`);
        return;
    }
    for (const listener of heard.listeners) listener(payload, sender);
}

// What main tells a page before the page hears it is not kept: a page reads what is so as it starts, and what main
// told before would come after that.
function heard(channel, payload) {
    for (const listener of listening.get(channel) || []) listener(payload);
}

function asked(channel, question) {
    if (answering.has(channel)) return reply(channel, question);
    if (!waiting.has(channel)) waiting.set(channel, []);
    waiting.get(channel).push(question);
}

// An answer that cannot cross a process goes back as the error it is, so the question is not left open.
function reply(channel, { id, payload }) {
    const answer = answering.get(channel);
    BIND.settle(() => answer(payload)).then((result) => {
        try {
            PROTOCOL.answer.send({ channel, id, ...result });
        } catch (error) {
            PROTOCOL.answer.send({ channel, id, error: BIND.errorOf(error) });
        }
    });
}

export { channels };
