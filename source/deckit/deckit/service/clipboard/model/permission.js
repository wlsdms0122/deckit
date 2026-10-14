DeckitModule.define(
    'deckit/service/clipboard/model/permission',
    {
        uses: [],
        provides: ['PERMISSION'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to read what was copied.
        const PERMISSION = 'system.clipboard';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PERMISSION };
    }
);
