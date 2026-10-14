DeckitModule.define(
    'deckit-ui/feature/switcher/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'ready',
            'open',
            'close',
            'dismiss',
            'hidden',
            'number',
            'need',
            'supply',
            'now',
            'query',
            'resolved',
            'pick',
        ],
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

        // The list's entries.
        need: IPC.rendererToMain('deckit:switcher-need', {}),
        supply: IPC.mainToRenderer('deckit:switcher-supply'),
        // `now` is sent again on its own as a slow source answers.
        now: IPC.mainToRenderer('deckit:switcher-now'),
        // `page`: the entry whose own page was typed in, or absent for the list.
        query: IPC.rendererToMain('deckit:switcher-query', { raw: 'string', page: 'string?' }),
        resolved: IPC.mainToRenderer('deckit:switcher-resolved'),
        pick: IPC.rendererToMain('deckit:switcher-pick', { id: 'string' }),
    })
);
