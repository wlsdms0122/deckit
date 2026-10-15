// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // Answers whether something took it.
        open: IPC.rendererToMain(
            'deckit:open',
            {
                url: 'string',
                activates: 'boolean',
                usesDefaultApp: 'boolean',
                target: 'string',
            },
            { reply: true }
        ),
        // The sending mod answers the url-schemes its manifest names.
        handles: IPC.rendererToMain('deckit:open-handles', {}),
        reveal: IPC.rendererToMain('deckit:open-reveal', { file: 'string' }, { reply: true }),
        // deckit.url-schemes: each scheme's handlers in order, and setting that order.
        handlerLists: IPC.rendererToMain('deckit:open-handler-lists', {}, { reply: true, sync: true }),
        setHandlers: IPC.rendererToMain(
            'deckit:open-handlers-set',
            { scheme: 'string', order: 'array', off: 'array' },
            { reply: true }
        ),
        // Asks a mod to open an address; it answers true when it took it.
        offer: IPC.mainToRenderer('deckit:open-offer', { reply: true }),
    });
}
