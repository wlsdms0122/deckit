DeckitModule.define(
    'deckit/service/notify/model/permission',
    {
        uses: [],
        provides: ['PERMISSION'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to show notices.
        const PERMISSION = 'system.notifications';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PERMISSION };
    }
);
