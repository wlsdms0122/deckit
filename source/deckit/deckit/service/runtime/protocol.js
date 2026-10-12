DeckitModule.define(
    'deckit/service/runtime/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['about', 'restart'],
        runs: 'electron',
    },
    (IPC) => ({
        // At once: a page draws it in one pass.
        about: IPC.rendererToMain('deckit:about', {}, { reply: true, sync: true }),
        restart: IPC.rendererToMain('deckit:restart', {}, { reply: true }),
    })
);
