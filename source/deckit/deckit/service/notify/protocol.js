DeckitModule.define(
    'deckit/service/notify/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['notify', 'clicked'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers whether it was shown. `id` comes back with clicked.
        notify: IPC.rendererToMain(
            'deckit:notify',
            { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
            { reply: true }
        ),
        clicked: IPC.mainToRenderer('deckit:notify-clicked'),
    })
);
