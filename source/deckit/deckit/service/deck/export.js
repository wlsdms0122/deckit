DeckitModule.define(
    'deckit/service/deck/export',
    {
        uses: ['deckit/service/deck/identity', 'deckit/service/deck/runner', 'deckit/service/deck/protocol'],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, PROTOCOL) => {
        // MARK: - Property
        // plugin id -> { settled: Promise, resolve, done, exports: { values, functions } | null, error }
        const providers = new Map();
        // Why a run terminates when the plugin launches again after it.
        const RUNS_AGAIN = new Set(['restart', 'updated']);

        // MARK: - Initializer
        // MARK: - Public
        // A plugin reaches another only through what that one exports, and only one it requires. Whoever requires a
        // plugin waits while it launches or terminates, until it has started, or failed to, or ended for good.
        function start() {
            RUNNER.observe('willLaunch', ({ plugin }) => expect(plugin.id));
            RUNNER.observe('didLaunch', ({ plugin, exports }) => provide(plugin.id, exports));
            RUNNER.observe('didFailToLaunch', ({ plugin, endReason }) => fail(plugin.id, endReason));
            RUNNER.observe('willTerminate', ({ plugin }) => expect(plugin.id));
            RUNNER.observe(
                'didTerminate',
                ({ plugin, endReason }) => !RUNS_AGAIN.has(endReason) && fail(plugin.id, endReason)
            );
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

        // MARK: - Private
        // Already waited for, it is still the same wait.
        function expect(pluginId) {
            if (providers.get(pluginId)?.done === false) return;
            let resolve;
            const settled = new Promise((done) => (resolve = done));
            providers.set(pluginId, { settled, resolve, done: false, exports: null, error: null });
        }

        function provide(pluginId, exports) {
            const provider = providers.get(pluginId);
            Object.assign(provider, { done: true, exports });
            provider.resolve();
        }

        function fail(pluginId, why) {
            const provider = providers.get(pluginId);
            if (!provider || provider.done) return;
            Object.assign(provider, { done: true, error: why });
            provider.resolve();
        }

        async function requirementsOf(plugin) {
            const out = {};
            for (const id of Object.keys(plugin.requires)) {
                const provider = providers.get(id);
                await provider.settled;
                out[id] = provider.exports || { error: `needs ${id}, which did not start: ${provider.error}` };
            }
            return out;
        }

        return { start };
    }
);
