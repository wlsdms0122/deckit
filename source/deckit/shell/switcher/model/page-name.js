DeckitModule.define(
    'shell/switcher/model/page-name',
    {
        uses: [],
        provides: ['PAGE_NAME'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The page the switcher's list is drawn in, at deckit://switcher/.
        const PAGE_NAME = 'switcher';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { PAGE_NAME };
    }
);
