DeckitModule.define(
    'deckit/service/deck/export',
    {
        uses: ['deckit/service/deck/identity', 'deckit/service/deck/runner', 'deckit/service/deck/protocol'],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, PROTOCOL) => {
        // MARK: - Property
        // plugin id -> { settled: Promise, resolve, done, exports: { values, functions } | null, error }: what a plugin
        // that starts is handed
        const providers = new Map();
        // plugin id -> the exports of its run that answers calls: running, or terminating until it has ended
        const answering = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A plugin reaches another only through what that one exports, and only one it requires. A plugin that starts
        // waits while what it requires launches or terminates, until it has started, or failed to, or ended for good.
        // A call reaches a terminating run until it has ended: the plugins that require it end first.
        function start() {
            RUNNER.observe('willLaunch', ({ plugin }) => expect(plugin.id));
            RUNNER.observe('didLaunch', ({ plugin, exports }) => {
                answering.set(plugin.id, exports);
                provide(plugin.id, exports);
            });
            RUNNER.observe('didFailToLaunch', ({ plugin, problem }) => fail(plugin.id, problem));
            RUNNER.observe('willTerminate', ({ plugin }) => expect(plugin.id));
            RUNNER.observe('didTerminate', (run) => {
                answering.delete(run.plugin.id);
                if (!run.relaunches) fail(run.plugin.id, run.problem || run.endReason);
            });
            PROTOCOL.requirements.handle((_payload, sender) => requirementsOf(IDENTITY.pluginFrom(sender)));
            // A call is its caller's run's, and a run that has ended makes none. A provider running again answers a
            // running caller once its new run has started; a terminating caller is answered only by the run it ran with.
            PROTOCOL.callExport.handle(async ({ run: number, plugin, path, args }, sender) => {
                const caller = IDENTITY.pluginFrom(sender);
                if (!Object.hasOwn(caller.requires, plugin)) throw new Error(`${caller.id} does not require ${plugin}`);
                const run = RUNNER.currentRun(sender, number);
                const ended = () => RUNNER.currentRun(sender, number) !== run || run.state === 'notRunning';
                if (!run || ended()) throw new Error(`${caller.id} is not running`);
                let exports = answering.get(plugin);
                if (!exports) {
                    if (run.state === 'terminating') throw new Error(`${plugin} is not running`);
                    const provider = providers.get(plugin);
                    await provider?.settled;
                    if (ended()) throw new Error(`${caller.id} is not running`);
                    if (provider?.error) throw new Error(`${plugin} is not running: ${provider.error}`);
                    exports = provider?.exports;
                }
                if (!exports?.functions.some((written) => written.join('.') === path.join('.'))) {
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

        // A wait ends failed; what a provider had exported, if anything, is no longer there to call.
        function fail(pluginId, problem) {
            const provider = providers.get(pluginId);
            if (!provider) return;
            if (provider.done) {
                providers.set(pluginId, { settled: Promise.resolve(), done: true, exports: null, error: problem });
                return;
            }
            Object.assign(provider, { done: true, error: problem });
            provider.resolve();
        }

        async function requirementsOf(plugin) {
            const out = {};
            for (const id of Object.keys(plugin.requires)) {
                const provider = providers.get(id);
                await provider.settled;
                out[id] = provider.exports || { error: `needs ${id}, which is not running: ${provider.error}` };
            }
            return out;
        }

        return { start };
    }
);
