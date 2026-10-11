DeckitModule.define(
    'deckit/service/keymap/model/global',
    {
        uses: [],
        provides: ['GLOBAL'],
        runs: 'any',
    },
    () => ({
        // Order is priority: when two share a chord only the first runs, and these come before any plugin's.
        GLOBAL: Object.freeze({
            'host.switcher': Object.freeze({ key: 'mod+shift+g', label: 'Quick switcher' }),
        }),
    })
);
