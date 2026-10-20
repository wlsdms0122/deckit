import * as CHANNEL from '../../deckit-shell/channel/index.js';

// Answers whether something took it.
export const open = CHANNEL.pageToMain(
    'deckit-electron:open',
    {
        url: 'string',
        activates: 'boolean',
        usesDefaultApp: 'boolean',
        target: 'string',
    },
    { reply: true }
);
export const reveal = CHANNEL.pageToMain('deckit-electron:open-reveal', { file: 'string' }, { reply: true });
// deckit.url-schemes: each scheme's handlers in order, and setting that order.
export const handlerLists = CHANNEL.pageToMain('deckit-electron:open-handler-lists', {}, { reply: true, sync: true });
export const setHandlers = CHANNEL.pageToMain(
    'deckit-electron:open-handlers-set',
    { scheme: 'string', order: 'array', off: 'array' },
    { reply: true }
);
// Asks a mod to open an address; it answers true when it took it.
export const offer = CHANNEL.mainToPage('deckit-electron:open-offer', { reply: true });
