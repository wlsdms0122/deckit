DeckitModule.define(
    'deck/service/log/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['line'],
        runs: 'electron',
    },
    (IPC) => ({
        // `level`: info, warn or error. `parts`: what was said, as text.
        line: IPC.rendererToMain('deck:log', { level: 'string', parts: 'array' }),
    })
);
