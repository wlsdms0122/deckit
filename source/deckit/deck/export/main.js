import * as VERSION from '../mod/version.js';
import * as PROTOCOL from './protocol.js';

export function createExport({ IDENTITY, RUNNER }) {
    // MARK: - Property
    // mod id -> { settled: Promise, resolve, done, exports: { values, functions } | null, error }: what a mod
    // that starts is handed
    const providers = new Map();
    // mod id -> the exports of its run that answers calls: running, or terminating until it has ended
    const answering = new Map();

    // MARK: - Initializer
    // MARK: - Public
    // A mod reaches another only through what that one exports, and only one it requires or has as an optional
    // dependency. A mod that starts waits while what it requires launches or terminates, until it has started, or
    // failed to, or ended for good. A call reaches a terminating run until it has ended: the mods that require it
    // end first. Its optional dependencies it does not wait for: it is handed what runs now, and told each time
    // that changes. The function called hears who called it (`deck.caller()`).
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => expect(mod.id));
        RUNNER.observe('didLaunch', ({ mod, contributions }) => {
            answering.set(mod.id, contributions.exports);
            provide(mod.id, contributions.exports);
            tellOptional(mod.id);
        });
        RUNNER.observe('didFailToLaunch', ({ mod, problem }) => fail(mod.id, problem));
        RUNNER.observe('willTerminate', ({ mod }) => {
            expect(mod.id);
            tellOptional(mod.id);
        });
        RUNNER.observe('didTerminate', (run) => {
            answering.delete(run.mod.id);
            if (!run.relaunches) fail(run.mod.id, run.problem || run.endReason);
            tellOptional(run.mod.id);
        });
        PROTOCOL.dependencies.handle((_payload, sender) => dependenciesOf(IDENTITY.modFrom(sender)));
        // A call is its caller's run's, and a run that has ended makes none. A provider running again answers a
        // running caller once its new run has started; a terminating caller is answered only by the run it ran with.
        PROTOCOL.callExport.handle(async ({ run: number, mod, path, args }, sender) => {
            const caller = IDENTITY.modFrom(sender);
            const optional = Object.hasOwn(caller.optional, mod);
            if (!Object.hasOwn(caller.requires, mod) && !optional)
                throw new Error(`${mod} is in neither [requires] nor [optional] of ${caller.id}`);
            if (optional && !usable(caller, mod)) throw new Error(unusable(caller, mod));
            const run = RUNNER.currentRun(sender, number);
            const ended = () => RUNNER.currentRun(sender, number) !== run || run.state === 'notRunning';
            if (!run || ended()) throw new Error(`${caller.id} is not running`);
            let exports = answering.get(mod);
            if (!exports) {
                if (run.state === 'terminating') throw new Error(`${mod} is not running`);
                const provider = providers.get(mod);
                await provider.settled;
                if (ended()) throw new Error(`${caller.id} is not running`);
                if (provider.error) throw new Error(`${mod} is not running: ${provider.error}`);
                exports = provider.exports;
            }
            if (!exports?.functions.some((written) => written.join('.') === path.join('.'))) {
                throw new Error(`${mod} exports no function ${path.join('.')}`);
            }
            return PROTOCOL.exportCalled.invoke(IDENTITY.pageOf(mod), { caller: caller.id, path, args });
        });
    }

    // Running, not yet ending, at a version it has optional: one that starts ending is gone to it at once, as a mod
    // that requires it would have ended first.
    function usable(mod, id) {
        const run = RUNNER.runOf(id);
        return answering.has(id) && run?.state === 'running' && VERSION.satisfies(run.mod.version, mod.optional[id]);
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
        if (provider.done) {
            providers.set(modId, { settled: Promise.resolve(), done: true, exports: null, error: problem });
            return;
        }
        Object.assign(provider, { done: true, error: problem });
        provider.resolve();
    }

    // What it requires, once each has started or failed, and its optional dependencies as they are now.
    async function dependenciesOf(mod) {
        const requires = {};
        for (const id of Object.keys(mod.requires)) {
            const provider = providers.get(id);
            await provider.settled;
            requires[id] = provider.exports || { error: `needs ${id}, which is not running: ${provider.error}` };
        }
        const optional = Object.fromEntries(Object.keys(mod.optional).map((id) => [id, optionalOf(mod, id)]));
        return { requires, optional };
    }

    // What an optional dependency exports while it can be used, or null.
    function optionalOf(mod, id) {
        return usable(mod, id) ? answering.get(id) : null;
    }

    function unusable(mod, id) {
        const run = RUNNER.runOf(id);
        if (run?.state !== 'running') return `${id} is not running`;
        return `${id} is ${run.mod.version}, and the [optional] of ${mod.id} names ${mod.optional[id]}`;
    }

    // Every running mod with `id` optional is told what it exports now, or that it is gone.
    function tellOptional(id) {
        for (const { run } of RUNNER.runs()) {
            if (!Object.hasOwn(run.mod.optional, id) || run.state === 'notRunning') continue;
            const page = IDENTITY.pageOf(run.mod.id);
            if (page) PROTOCOL.optionalChanged.send(page, { id, exports: optionalOf(run.mod, id) });
        }
    }

    return { start, usable };
}
