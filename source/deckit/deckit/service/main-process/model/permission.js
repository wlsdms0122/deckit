DeckitModule.define(
    'deckit/service/main-process/model/permission',
    {
        uses: [],
        provides: ['MAIN_PROCESS'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to run its own code in the app's main process.
        const MAIN_PROCESS = 'system.main-process';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { MAIN_PROCESS };
    }
);
