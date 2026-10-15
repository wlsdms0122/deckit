import * as IPC from '../../deck/ipc/index.js';

// Answers whether something took it.
export const open = IPC.rendererToMain(
    'deckit:open',
    {
        url: 'string',
        activates: 'boolean',
        usesDefaultApp: 'boolean',
        target: 'string',
    },
    { reply: true }
);
// The sending mod answers the url-schemes its manifest names.
export const handles = IPC.rendererToMain('deckit:open-handles', {});
export const reveal = IPC.rendererToMain('deckit:open-reveal', { file: 'string' }, { reply: true });
// deckit.url-schemes: each scheme's handlers in order, and setting that order.
export const handlerLists = IPC.rendererToMain('deckit:open-handler-lists', {}, { reply: true, sync: true });
export const setHandlers = IPC.rendererToMain(
    'deckit:open-handlers-set',
    { scheme: 'string', order: 'array', off: 'array' },
    { reply: true }
);
// Asks a mod to open an address; it answers true when it took it.
export const offer = IPC.mainToRenderer('deckit:open-offer', { reply: true });
