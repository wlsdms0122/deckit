DeckitModule.define(
    'deckit/service/switcher/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'need',
            'supply',
            'now',
            'query',
            'resolved',
            'pick',
            'source',
            'collect',
            'collectNow',
            'resolve',
            'search',
            'run',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // The switcher's list and main.
        need: IPC.rendererToMain('deckit:switcher-need', {}),
        supply: IPC.mainToRenderer('deckit:switcher-supply'),
        // `now` is sent again on its own as a slow source answers.
        now: IPC.mainToRenderer('deckit:switcher-now'),
        // `page`: the entry whose own page was typed in, or absent for the list.
        query: IPC.rendererToMain('deckit:switcher-query', { raw: 'string', page: 'string?' }),
        resolved: IPC.mainToRenderer('deckit:switcher-resolved'),
        pick: IPC.rendererToMain('deckit:switcher-pick', { id: 'string' }),

        // A plugin's view and main. `source`: what the sending plugin answers.
        source: IPC.rendererToMain('deckit:switcher-source', {
            icon: 'string',
            aliases: 'array',
            opens: 'boolean',
            resolves: 'boolean',
        }),
        collect: IPC.mainToRenderer('deckit:switcher-collect', { reply: true }),
        collectNow: IPC.mainToRenderer('deckit:switcher-collect-now', { reply: true }),
        resolve: IPC.mainToRenderer('deckit:switcher-resolve', { reply: true }),
        search: IPC.mainToRenderer('deckit:switcher-search', { reply: true }),
        run: IPC.mainToRenderer('deckit:switcher-run', { reply: true }),
    })
);
