// The channels a layer on deck speaks over: each carries the name of the layer's own channel beside what it says, so
// Electron's IPC knows only deckit-electron's names, and a page hears every question main asks a layer from its start.
import * as CHANNEL from '../../../deckit-driver/channel/index.js';

// What a page tells a layer in main.
export const told = CHANNEL.pageToMain('deckit-electron:layer-told', { channel: 'string', payload: 'object' });
// What a page asks a layer in main, and asks waiting for the answer.
export const asked = CHANNEL.pageToMain(
    'deckit-electron:layer-asked',
    { channel: 'string', payload: 'object' },
    { reply: true }
);
export const askedAtOnce = CHANNEL.pageToMain(
    'deckit-electron:layer-asked-at-once',
    { channel: 'string', payload: 'object' },
    { reply: true, sync: true }
);
// What a layer in main tells a page, { channel, payload }, or asks it, { channel, id, payload }.
export const toPage = CHANNEL.mainToPage('deckit-electron:layer');
// A page's answer to question `id`: `value`, or `error` { message, kind }.
export const answer = CHANNEL.pageToMain('deckit-electron:layer-answer', {
    channel: 'string',
    id: 'number',
    value: 'any?',
    error: 'object?',
});
