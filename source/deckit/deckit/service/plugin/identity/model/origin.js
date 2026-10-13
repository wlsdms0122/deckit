DeckitModule.define(
    'deckit/service/plugin/identity/model/origin',
    {
        uses: [],
        provides: ['SCHEME', 'SWITCHER_ORIGIN', 'originOf', 'pluginOfHost', 'addressOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The scheme deckit's pages load from, as Electron's registerSchemesAsPrivileged takes it.
        const SCHEME = Object.freeze({
            scheme: 'deckit',
            privileges: Object.freeze({ standard: true, secure: true, supportFetchAPI: true }),
        });
        // Every plugin host ends in .plugin, so deckit's own pages (the switcher's) never share an origin with one.
        const PLUGIN_HOST_SUFFIX = '.plugin';
        const SWITCHER_ORIGIN = `${SCHEME.scheme}://switcher`;

        // MARK: - Initializer
        // MARK: - Public
        // Where a plugin's page loads from: an origin of its own, so its page storage is no one else's.
        function originOf(pluginId) {
            return `${SCHEME.scheme}://${pluginId}${PLUGIN_HOST_SUFFIX}`;
        }

        // The plugin whose origin a host is, or null.
        function pluginOfHost(host) {
            return host.endsWith(PLUGIN_HOST_SUFFIX) ? host.slice(0, -PLUGIN_HOST_SUFFIX.length) : null;
        }

        // The one address a deckit page has: its origin's root. Everything else of the origin is a file it uses.
        function addressOf(origin) {
            return origin + '/';
        }

        // MARK: - Private

        return { SCHEME, SWITCHER_ORIGIN, originOf, pluginOfHost, addressOf };
    }
);
