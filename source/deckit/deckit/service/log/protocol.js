DeckitModule.define(
    'deckit/service/log/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['line'],
        runs: 'electron',
    },
    (IPC) => ({
        // `level`: info, warn or error. `parts`: what was said, as text.
        line: IPC.rendererToMain('deckit:log', { level: 'string', parts: 'array' }),
    })
);
