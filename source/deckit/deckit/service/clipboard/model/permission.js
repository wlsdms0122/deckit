DeckitModule.define(
    'deckit/service/clipboard/model/permission',
    {
        uses: [],
        provides: ['CLIPBOARD'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to read what was copied.
        const CLIPBOARD = 'system.clipboard';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { CLIPBOARD };
    }
);
