import * as CHANNEL from '../../channel/index.js';

// What carries every channel's message between main and a page: the message beside its channel's name. A page runs
// code main does not trust, so main holds what a page sends to these before it reads the message inside. Main tells a
// page { channel, payload } and asks it { channel, id, payload, timeout }, both as tells.
// MARK: - Property
// What a page tells main, and asks it, waiting for the answer when it asks sync: { channel, payload }.
const told = CHANNEL.pageToMain("a page's tell", { channel: 'string', payload: 'object' });
const asked = CHANNEL.pageToMain("a page's question", { channel: 'string', payload: 'object' }, { reply: true });
const askedSync = CHANNEL.pageToMain(
    "a page's sync question",
    { channel: 'string', payload: 'object' },
    { reply: true, sync: true }
);
// What a page answers main's question, as a tell: `value`, or `error` { message, kind }.
const answer = CHANNEL.pageToMain("a page's answer", {
    channel: 'string',
    id: 'number',
    value: 'any?',
    error: 'object?',
});

// MARK: - Initializer
// MARK: - Public
// A question and its answer carry the id main gave the question; a tell carries none.
function ofQuestion(message) {
    return CHANNEL.kindOf(message) === 'object' && Object.hasOwn(message, 'id');
}

// MARK: - Private

export { told, asked, askedSync, answer, ofQuestion };
