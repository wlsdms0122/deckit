DeckitModule.define(
    'deckit/service/command/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['source', 'collect', 'collectNow', 'resolve', 'search', 'run', 'end'],
        runs: 'electron',
    },
    (IPC) => ({
        // What the sending mod answers.
        source: IPC.rendererToMain('deckit:command-source', { resolves: 'boolean' }),
        // Each question carries the session it is for, whose entries the page keeps until it ends.
        collect: IPC.mainToRenderer('deckit:command-collect', { reply: true }),
        collectNow: IPC.mainToRenderer('deckit:command-collect-now', { reply: true }),
        resolve: IPC.mainToRenderer('deckit:command-resolve', { reply: true }),
        search: IPC.mainToRenderer('deckit:command-search', { reply: true }),
        run: IPC.mainToRenderer('deckit:command-run', { reply: true }),
        end: IPC.mainToRenderer('deckit:command-end'),
    })
);
