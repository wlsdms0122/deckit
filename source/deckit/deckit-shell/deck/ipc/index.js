import * as CHANNEL from '../channel/index.js';

// What main's side and a page's side of the channels share: the table of what is bound and heard on a side, and how an
// answer crosses. Each side keeps one table (main.js, renderer.js).
// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A side's channels. `sides` makes what a channel is on this side from its copy: `toMain(copy)` for one a page asks or
// tells main, `toPage(copy)` for one main asks or tells a page. What is bound is a copy of the declaration, read once,
// so nothing changes it after. A channel is declared once: binding the same declaration again binds the same channel,
// and another declaration of its name is refused. A layer's are bound as any other, but never one deck binds as its
// own, whoever declares it.
function createTable(sides) {
    const declared = new Map(); // channel -> the declaration it was bound as, so it is declared once
    // The channels heard here, by name: { copy, answer, listeners }, once something answers or listens on one.
    const heard = new Map();
    const own = new Set(); // the channels deck binds as its own

    function bindOwn(given) {
        const copy = copyOf(given);
        const bound = bindCopy(given, copy);
        own.add(copy.channel);
        return bound;
    }

    function bindLayer(given) {
        const copy = copyOf(given);
        if (own.has(copy.channel)) throw new Error(`[deckit] ${copy.channel} is deck's, not a layer's to declare`);
        return bindCopy(given, copy);
    }

    function bindCopy(given, copy) {
        const known = declared.get(copy.channel);
        if (known && known !== given) throw new Error(`[deckit] ${copy.channel} is declared already`);
        declared.set(copy.channel, given);
        return Object.freeze(copy.to === 'main' ? sides.toMain(copy) : sides.toPage(copy));
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

    return {
        // What deck's concepts bind their channels with, and what a layer on deck is handed for its own.
        ownChannels: Object.freeze({ bind: bindOwn }),
        layerChannels: Object.freeze({ bind: bindLayer }),
        hear,
        answerWith,
        heardOf: (channel) => heard.get(channel),
    };
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

// What `work` comes to, as an answer that crosses: `value`, or `error`.
function settle(work) {
    return Promise.resolve()
        .then(work)
        .then(
            (value) => ({ value }),
            (error) => ({ error: errorOf(error) })
        );
}

// MARK: - Private
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

export { createTable, errorOf, failure, refusal, unwrap, settle };
