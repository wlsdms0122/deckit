DeckitModule.define(
    'shell/service/style/model/permission',
    {
        uses: [],
        provides: ['PERMISSION'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to style other pages.
        const PERMISSION = 'deckit.styles';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PERMISSION };
    }
);
