DeckitModule.define(
    'deckit/service/home/model/config',
    {
        uses: ['app/config?'],
        provides: ['id', 'name', 'restore', 'agent', 'openWith'],
        runs: 'any',
    },
    (app) => {
        const DEFAULTS = {
            id: 'deckit',
            name: 'Deckit',
            restore: null,
            agent: [],
            openWith: {},
        };
        const unknown = Object.keys(app || {}).filter((key) => !(key in DEFAULTS));
        if (unknown.length)
            throw new Error(`[deckit] app/config sets ${unknown.join(', ')}, which deckit does not read`);
        return Object.freeze({ ...DEFAULTS, ...(app || {}) });
    }
);
