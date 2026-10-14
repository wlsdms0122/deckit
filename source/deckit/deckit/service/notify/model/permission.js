DeckitModule.define(
    'deckit/service/notify/model/permission',
    {
        uses: [],
        provides: ['NOTIFICATIONS'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to show notices.
        const NOTIFICATIONS = 'system.notifications';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { NOTIFICATIONS };
    }
);
