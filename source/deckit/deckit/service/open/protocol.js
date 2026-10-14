DeckitModule.define(
    'deckit/service/open/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['open', 'handles', 'reveal', 'handlerLists', 'setHandlers', 'offer'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers whether something took it. `userInitiated`: a person asked, so a file may be opened, not only shown.
        open: IPC.rendererToMain(
            'deckit:open',
            {
                url: 'string',
                activates: 'boolean',
                userInitiated: 'boolean',
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
    })
);
