DeckitModule.define(
    'deckit/service/clipboard/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['readText', 'writeText'],
        runs: 'electron',
    },
    (IPC) => ({
        readText: IPC.rendererToMain('deckit:clipboard-read', {}, { reply: true }),
        writeText: IPC.rendererToMain('deckit:clipboard-write', { text: 'string' }, { reply: true }),
    })
);
