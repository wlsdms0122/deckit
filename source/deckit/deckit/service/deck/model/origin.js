DeckitModule.define(
    'deckit/service/deck/model/origin',
    {
        uses: [],
        provides: ['SCHEME', 'SWITCHER_ORIGIN', 'originOf', 'modOfHost', 'addressOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The scheme deckit's pages load from, as Electron's registerSchemesAsPrivileged takes it.
        const SCHEME = Object.freeze({
            scheme: 'deckit',
            privileges: Object.freeze({ standard: true, secure: true, supportFetchAPI: true }),
        });
        // Every mod host ends in .mod, so deckit's own pages (the switcher's) never share an origin with one.
        const MOD_HOST_SUFFIX = '.mod';
        const SWITCHER_ORIGIN = `${SCHEME.scheme}://switcher`;

        // MARK: - Initializer
        // MARK: - Public
        // Where a mod's page loads from: an origin of its own, so its page storage is no one else's.
        function originOf(modId) {
            return `${SCHEME.scheme}://${modId}${MOD_HOST_SUFFIX}`;
        }

        // The mod whose origin a host is, or null.
        function modOfHost(host) {
            return host.endsWith(MOD_HOST_SUFFIX) ? host.slice(0, -MOD_HOST_SUFFIX.length) : null;
        }

        // The one address a deckit page has: its origin's root. Everything else of the origin is a file it uses.
        function addressOf(origin) {
            return origin + '/';
        }

        // MARK: - Private

        return { SCHEME, SWITCHER_ORIGIN, originOf, modOfHost, addressOf };
    }
);
