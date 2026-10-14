DeckitModule.define(
    'deckit/build',
    {
        uses: [],
        provides: ['VERSION', 'SOURCE'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // Which deckit this is: its version and the hash of its sources, which the build writes in here. Run from its
        // sources, there are none.
        const VERSION = null;
        const SOURCE = null;

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { VERSION, SOURCE };
    }
);
