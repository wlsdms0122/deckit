// Shared by open and the manifest check, so the two cannot disagree about what can be opened.
DeckitModule.define(
    'deckit/service/open/model/scheme',
    {
        uses: [],
        provides: ['SCHEME', 'NOT_PLACES', 'EVERY'],
        runs: 'any',
    },
    () =>
        Object.freeze({
            // RFC 3986, lower case as compared.
            SCHEME: /^[a-z][a-z0-9+.-]*$/,
            // What a page runs or holds itself: nothing opens these.
            NOT_PLACES: new Set(['javascript', 'data', 'blob', 'about']),
            EVERY: '*',
        })
);
