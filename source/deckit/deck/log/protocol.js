DeckitModule.define(
    'deck/log/protocol',
    {
        uses: ['core/ipc'],
        provides: ['line'],
        runs: 'electron',
    },
    (IPC) => ({
        // `level`: info, warn or error. `parts`: what was said, as text.
        line: IPC.rendererToMain('deck:log', { level: 'string', parts: 'array' }),
    })
);
