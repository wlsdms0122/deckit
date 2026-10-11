DeckitModule.define(
    'deckit/feature/switcher/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['ready', 'open', 'close', 'dismiss', 'hidden', 'number'],
        runs: 'electron',
    },
    (IPC) => ({
        // The page may finish loading after the chord that opened it.
        ready: IPC.rendererToMain('deckit:switcher-ready', {}),
        open: IPC.mainToRenderer('deckit:switcher-open'),
        close: IPC.rendererToMain('deckit:switcher-close', {}),
        // { token }, which comes back with hidden once the exit has played.
        dismiss: IPC.mainToRenderer('deckit:switcher-dismiss'),
        hidden: IPC.rendererToMain('deckit:switcher-hidden', { token: 'number?' }),
        // { number }: ⌘1 to ⌘9 pressed in the list.
        number: IPC.mainToRenderer('deckit:switcher-number'),
    })
);
