import * as CHANNEL from '../deck/channel/index.js';

// Answers whether something took it.
export const open = CHANNEL.pageToMain(
    'deckit-shell:open',
    {
        url: 'string',
        activates: 'boolean',
        usesDefaultApp: 'boolean',
        target: 'string',
    },
    { reply: true }
);
export const reveal = CHANNEL.pageToMain('deckit-shell:open-reveal', { file: 'string' }, { reply: true });
// deckit.url-schemes: each scheme's handlers in order, and setting that order.
export const handlerLists = CHANNEL.pageToMain('deckit-shell:open-handler-lists', {}, { reply: true, sync: true });
export const setHandlers = CHANNEL.pageToMain(
    'deckit-shell:open-handlers-set',
    { scheme: 'string', order: 'array', off: 'array' },
    { reply: true }
);
// Asks a mod to open an address; it answers true when it took it.
export const offer = CHANNEL.mainToPage('deckit-shell:open-offer', { reply: true });
