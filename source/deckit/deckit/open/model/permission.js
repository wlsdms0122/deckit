DeckitModule.define(
    'deckit/open/model/permission',
    {
        uses: [],
        provides: ['URL_SCHEMES'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds to choose which mod is asked first to open each scheme's addresses.
        const URL_SCHEMES = 'deckit.url-schemes';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { URL_SCHEMES };
    }
);
