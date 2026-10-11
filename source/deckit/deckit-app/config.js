DeckitModule.define(
    'app/config',
    {
        uses: [],
        provides: ['id', 'name'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { id: 'deckit', name: 'Deckit' };
    }
);
