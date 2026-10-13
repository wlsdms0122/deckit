DeckitModule.define(
    'deckit/service/plugin/deck/export',
    {
        uses: ['deckit/service/plugin/identity', 'deckit/service/plugin/deck/protocol'],
        provides: ['start', 'expect', 'provide', 'fail'],
        runs: 'main',
    },
    (IDENTITY, PROTOCOL) => {
        // MARK: - Property
        // plugin id -> { settled: Promise, resolve, exports: { values, functions } | null, error }
        const providers = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A plugin reaches another only through what that one exports, and only one it requires.
        function start() {
            PROTOCOL.requirements.handle((_payload, sender) => requirementsOf(IDENTITY.pluginFrom(sender)));
            // A provider running again answers once its new run has started.
            PROTOCOL.callExport.handle(async ({ plugin, path, args }, sender) => {
                const caller = IDENTITY.pluginFrom(sender);
                if (!Object.hasOwn(caller.requires, plugin)) throw new Error(`${caller.id} does not require ${plugin}`);
                const provider = providers.get(plugin);
                await provider?.settled;
                if (!provider?.exports?.functions.some((written) => written.join('.') === path.join('.'))) {
                    throw new Error(`${plugin} exports no function ${path.join('.')}`);
                }
                return PROTOCOL.exportCalled.invoke(IDENTITY.pageOf(plugin), { path, args });
            });
        }

        // Before a plugin's view starts: whoever requires it waits until it has started or failed.
        function expect(pluginId) {
            let resolve;
            const settled = new Promise((done) => (resolve = done));
            providers.set(pluginId, { settled, resolve, exports: null, error: null });
        }

        function provide(pluginId, exports) {
            const provider = providers.get(pluginId);
            provider.exports = exports;
            provider.resolve();
        }

        function fail(pluginId, why) {
            const provider = providers.get(pluginId);
            if (!provider || provider.exports) return;
            provider.error = why;
            provider.resolve();
        }

        // MARK: - Private
        async function requirementsOf(plugin) {
            const out = {};
            for (const id of Object.keys(plugin.requires)) {
                const provider = providers.get(id);
                await provider.settled;
                out[id] = provider.exports || { error: `needs ${id}, which did not start: ${provider.error}` };
            }
            return out;
        }

        return { start, expect, provide, fail };
    }
);
