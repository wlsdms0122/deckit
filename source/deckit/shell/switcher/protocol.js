DeckitModule.define(
    'shell/switcher/protocol',
    {
        uses: ['core/ipc'],
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
        ready: IPC.rendererToMain('shell:switcher-ready', {}),
        open: IPC.mainToRenderer('shell:switcher-open'),
        close: IPC.rendererToMain('shell:switcher-close', {}),
        // { token }, which comes back with hidden once the exit has played.
        dismiss: IPC.mainToRenderer('shell:switcher-dismiss'),
        hidden: IPC.rendererToMain('shell:switcher-hidden', { token: 'number?' }),
        // { number }: ⌘1 to ⌘9 pressed in the list.
        number: IPC.mainToRenderer('shell:switcher-number'),

        // The list's entries.
        need: IPC.rendererToMain('shell:switcher-need', {}),
        supply: IPC.mainToRenderer('shell:switcher-supply'),
        // `now` is sent again on its own as a slow source answers.
        now: IPC.mainToRenderer('shell:switcher-now'),
        // `page`: the entry whose own page was typed in, or absent for the list.
        query: IPC.rendererToMain('shell:switcher-query', { raw: 'string', page: 'string?' }),
        resolved: IPC.mainToRenderer('shell:switcher-resolved'),
        pick: IPC.rendererToMain('shell:switcher-pick', { id: 'string' }),
    })
);
