// The channels every other crosses over, Electron's IPC knowing only these: each message carries the name of the
// channel it is on beside what it says.
import * as CHANNEL from '../../../deckit-shell/channel/index.js';

// What a page tells main, and asks it, waiting for the answer when the channel is `sync`: { channel, payload }.
export const pageTells = CHANNEL.pageToMain('deckit-electron:page-tells', { channel: 'string', payload: 'object' });
export const pageAsks = CHANNEL.pageToMain(
    'deckit-electron:page-asks',
    { channel: 'string', payload: 'object' },
    { reply: true }
);
export const pageAsksSync = CHANNEL.pageToMain(
    'deckit-electron:page-asks-sync',
    { channel: 'string', payload: 'object' },
    { reply: true, sync: true }
);
// What main tells a page, { channel, payload }, and asks it, { channel, id, payload, timeout }: the page answers on
// pageAnswers, `value` or `error` { message, kind }.
export const mainTells = CHANNEL.mainToPage('deckit-electron:main-tells');
export const mainAsks = CHANNEL.mainToPage('deckit-electron:main-asks');
export const pageAnswers = CHANNEL.pageToMain('deckit-electron:page-answers', {
    channel: 'string',
    id: 'number',
    value: 'any?',
    error: 'object?',
});
