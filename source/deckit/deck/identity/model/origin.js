DeckitModule.define(
    'deck/identity/model/origin',
    {
        uses: [],
        provides: ['SCHEME', 'originOf', 'pageOriginOf', 'modOfHost', 'addressOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The scheme the pages deck makes load from, as Electron's registerSchemesAsPrivileged takes it.
        const SCHEME = Object.freeze({
            scheme: 'deckit',
            privileges: Object.freeze({ standard: true, secure: true, supportFetchAPI: true }),
        });
        // Every mod host ends in .mod, so a page that runs no mod never shares an origin with one.
        const MOD_HOST_SUFFIX = '.mod';

        // MARK: - Initializer
        // MARK: - Public
        // Where a mod's page loads from: an origin of its own, so its page storage is no one else's.
        function originOf(modId) {
            return `${SCHEME.scheme}://${modId}${MOD_HOST_SUFFIX}`;
        }

        // Where a page that runs no mod loads from, by its name, which has no dot in it.
        function pageOriginOf(name) {
            return `${SCHEME.scheme}://${name}`;
        }

        // The mod whose origin a host is, or null.
        function modOfHost(host) {
            return host.endsWith(MOD_HOST_SUFFIX) ? host.slice(0, -MOD_HOST_SUFFIX.length) : null;
        }

        // The one address a page has: its origin's root. Everything else of the origin is a file it uses.
        function addressOf(origin) {
            return origin + '/';
        }

        // MARK: - Private

        return { SCHEME, originOf, pageOriginOf, modOfHost, addressOf };
    }
);
