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
            'listening',
            'collect',
            'offer',
            'offerNow',
            'search',
            'found',
            'run',
        ],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            /* ---------- the switcher's page and main ---------- */
            need: IPC.report('deckit:switcher-need', {}),
            // `now` is sent again on its own when a slow source answers.
            supply: IPC.tell('deckit:switcher-supply', { items: 'array', now: 'array' }),
            now: IPC.tell('deckit:switcher-now', { rows: 'array' }),
            // `page`: the entry whose own page was typed in, or absent for the list.
            query: IPC.report('deckit:switcher-query', { raw: 'string', page: 'string?' }),
            resolved: IPC.tell('deckit:switcher-resolved', { raw: 'string', entries: 'array', page: 'string?' }),
            pick: IPC.report('deckit:switcher-pick', { id: 'string' }),

            /* ---------- the panel's page and main ---------- */
            // Sent once the page's plugins are made and registered.
            listening: IPC.report('deckit:switcher-listening', {}),
            collect: IPC.tell('deckit:switcher-collect', {}),
            offer: IPC.report('deckit:switcher-offer', { items: 'array', now: 'array' }),
            offerNow: IPC.report('deckit:switcher-offer-now', { rows: 'array' }),
            search: IPC.tell('deckit:switcher-search', { raw: 'string', page: 'string?' }),
            found: IPC.report('deckit:switcher-found', { raw: 'string', entries: 'array', page: 'string?' }),
            run: IPC.tell('deckit:switcher-run', { id: 'string' }),
        })
);
