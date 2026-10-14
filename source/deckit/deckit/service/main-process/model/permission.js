DeckitModule.define(
    'deckit/service/main-process/model/permission',
    {
        uses: [],
        provides: ['PERMISSION'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to run its own code in the app's main process.
        const PERMISSION = 'system.main-process';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PERMISSION };
    }
);
