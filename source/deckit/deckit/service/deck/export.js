DeckitModule.define(
    'deckit/service/deck/export',
    {
        uses: ['deckit/service/deck/identity', 'deckit/service/deck/runner', 'deckit/service/deck/protocol'],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, PROTOCOL) => {
        // MARK: - Property
        // mod id -> { settled: Promise, resolve, done, exports: { values, functions } | null, error }: what a mod
        // that starts is handed
        const providers = new Map();
        // mod id -> the exports of its run that answers calls: running, or terminating until it has ended
        const answering = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A mod reaches another only through what that one exports, and only one it requires. A mod that starts
        // waits while what it requires launches or terminates, until it has started, or failed to, or ended for good.
        // A call reaches a terminating run until it has ended: the mods that require it end first.
        function start() {
            RUNNER.observe('willLaunch', ({ mod }) => expect(mod.id));
            RUNNER.observe('didLaunch', ({ mod, contributions }) => {
                answering.set(mod.id, contributions.exports);
                provide(mod.id, contributions.exports);
            });
            RUNNER.observe('didFailToLaunch', ({ mod, problem }) => fail(mod.id, problem));
            RUNNER.observe('willTerminate', ({ mod }) => expect(mod.id));
            RUNNER.observe('didTerminate', (run) => {
                answering.delete(run.mod.id);
                if (!run.relaunches) fail(run.mod.id, run.problem || run.endReason);
            });
            PROTOCOL.requirements.handle((_payload, sender) => requirementsOf(IDENTITY.modFrom(sender)));
            // A call is its caller's run's, and a run that has ended makes none. A provider running again answers a
            // running caller once its new run has started; a terminating caller is answered only by the run it ran with.
            PROTOCOL.callExport.handle(async ({ run: number, mod, path, args }, sender) => {
                const caller = IDENTITY.modFrom(sender);
                if (!Object.hasOwn(caller.requires, mod)) throw new Error(`${caller.id} does not require ${mod}`);
                const run = RUNNER.currentRun(sender, number);
                const ended = () => RUNNER.currentRun(sender, number) !== run || run.state === 'notRunning';
                if (!run || ended()) throw new Error(`${caller.id} is not running`);
                let exports = answering.get(mod);
                if (!exports) {
                    if (run.state === 'terminating') throw new Error(`${mod} is not running`);
                    const provider = providers.get(mod);
                    await provider?.settled;
                    if (ended()) throw new Error(`${caller.id} is not running`);
                    if (provider?.error) throw new Error(`${mod} is not running: ${provider.error}`);
                    exports = provider?.exports;
                }
                if (!exports?.functions.some((written) => written.join('.') === path.join('.'))) {
                    throw new Error(`${mod} exports no function ${path.join('.')}`);
                }
                return PROTOCOL.exportCalled.invoke(IDENTITY.pageOf(mod), { path, args });
            });
        }

        // MARK: - Private
        // Already waited for, it is still the same wait.
        function expect(modId) {
            if (providers.get(modId)?.done === false) return;
            let resolve;
            const settled = new Promise((done) => (resolve = done));
            providers.set(modId, { settled, resolve, done: false, exports: null, error: null });
        }

        function provide(modId, exports) {
            const provider = providers.get(modId);
            Object.assign(provider, { done: true, exports });
            provider.resolve();
        }

        // A wait ends failed; what a provider had exported, if anything, is no longer there to call.
        function fail(modId, problem) {
            const provider = providers.get(modId);
            if (!provider) return;
            if (provider.done) {
                providers.set(modId, { settled: Promise.resolve(), done: true, exports: null, error: problem });
                return;
            }
            Object.assign(provider, { done: true, error: problem });
            provider.resolve();
        }

        async function requirementsOf(mod) {
            const out = {};
            for (const id of Object.keys(mod.requires)) {
                const provider = providers.get(id);
                await provider.settled;
                out[id] = provider.exports || { error: `needs ${id}, which is not running: ${provider.error}` };
            }
            return out;
        }

        return { start };
    }
);
