DeckitModule.define(
    'deckit/feature/switcher/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['ready', 'open', 'close', 'dismiss', 'hidden'],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            // The page may finish loading after the chord that opened it.
            ready: IPC.report('deckit:switcher-ready', {}),
            open: IPC.tell('deckit:switcher-open', {}),
            close: IPC.report('deckit:switcher-close', {}),
            // `token` comes back with hidden once the exit has played.
            dismiss: IPC.tell('deckit:switcher-dismiss', { token: 'number?' }),
            hidden: IPC.report('deckit:switcher-hidden', { token: 'number?' }),
        })
);
