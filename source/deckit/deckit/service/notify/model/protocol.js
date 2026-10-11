DeckitModule.define(
    'deckit/service/notify/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['notify', 'clicked'],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            // `id` is the page's own, echoed back in `clicked`.
            notify: IPC.ask('deckit:notify', { id: 'string', title: 'string', body: 'string', silent: 'boolean' }),
            clicked: IPC.tell('deckit:notify-click', { id: 'string' }),
        })
);
