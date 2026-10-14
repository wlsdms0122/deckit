DeckitModule.define(
    'shell/service/style/model/permission',
    {
        uses: [],
        provides: ['STYLES'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to style other pages.
        const STYLES = 'deckit.styles';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { STYLES };
    }
);
