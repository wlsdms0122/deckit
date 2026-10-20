import * as CHANNEL from '../../channel/index.js';

// What carries every channel's message between main and a page: the message beside its channel's name. A page runs
// code main does not trust, so main holds what a page sends to these before it reads the message inside.
// MARK: - Property
// What a page tells main, and asks it, waiting for the answer when it asks sync: { channel, payload }.
const told = CHANNEL.pageToMain('what a page tells', { channel: 'string', payload: 'object' });
const asked = CHANNEL.pageToMain('what a page asks', { channel: 'string', payload: 'object' }, { reply: true });
const askedSync = CHANNEL.pageToMain(
    'what a page asks sync',
    { channel: 'string', payload: 'object' },
    { reply: true, sync: true }
);
// What a page answers main's question: `value`, or `error` { message, kind }. Main tells a page { channel, payload }
// and asks it { channel, id, payload, timeout }.
const answer = CHANNEL.pageToMain('what a page answers', {
    channel: 'string',
    id: 'number',
    value: 'any?',
    error: 'object?',
});

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { told, asked, askedSync, answer };
