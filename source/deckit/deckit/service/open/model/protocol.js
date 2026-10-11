DeckitModule.define(
    'deckit/service/open/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['open', 'handles', 'reveal', 'lines', 'setLine', 'offer'],
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
        // The sending plugin answers the url-schemes its manifest names.
        handles: IPC.rendererToMain('deckit:open-handles', {}),
        reveal: IPC.rendererToMain('deckit:open-reveal', { file: 'string' }, { reply: true }),
        // deckit.url-schemes
        lines: IPC.rendererToMain('deckit:open-lines', {}, { reply: true, sync: true }),
        setLine: IPC.rendererToMain(
            'deckit:open-line-set',
            { line: 'string', order: 'array', off: 'array' },
            { reply: true }
        ),
        // Asks a plugin to open an address; it answers true when it took it.
        offer: IPC.mainToRenderer('deckit:open-offer', { reply: true }),
    })
);
