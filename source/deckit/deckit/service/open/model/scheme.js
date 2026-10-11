DeckitModule.define(
    'deckit/service/open/model/scheme',
    {
        uses: [],
        provides: ['SCHEME', 'NOT_PLACES', 'EVERY'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // RFC 3986, lower case as compared.
        const SCHEME = /^[a-z][a-z0-9+.-]*$/;
        // What a page runs or holds itself: nothing opens these.
        const NOT_PLACES = new Set(['javascript', 'data', 'blob', 'about']);
        const EVERY = '*';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { SCHEME, NOT_PLACES, EVERY };
    }
);
