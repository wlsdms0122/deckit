DeckitModule.define(
    'deckit/service/clipboard/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['readText', 'writeText'],
        runs: 'electron',
    },
    (IPC) => ({
        readText: IPC.rendererToMain('deckit:clipboard-read', {}, { reply: true }),
        writeText: IPC.rendererToMain('deckit:clipboard-write', { text: 'string' }, { reply: true }),
    })
);
