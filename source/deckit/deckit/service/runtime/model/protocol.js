DeckitModule.define(
    'deckit/service/runtime/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['about', 'restart'],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            // Synchronous: a page draws it in one pass.
            about: IPC.ask('deckit:about', {}, { now: true }),
            restart: IPC.ask('deckit:app-restart', {}),
        })
);
