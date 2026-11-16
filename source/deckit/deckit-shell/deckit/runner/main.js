import * as EVENT_BUS from '../../../deckit-sdk/deckit/event/bus.js';
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD from '../catalog/model/mod.js';
import * as RUN from './model/run.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Its channels as a run a transport connection hosts speaks them (outside/): `asked`, method -> the channel and whether
// its payload carries the run's number, and `told`, channel -> method.
export const OUTSIDE = Object.freeze({
    asked: {
        'runner/started': { channel: DECLARED.started, run: true, adding: { summary: {} } },
        'runner/problem': { channel: DECLARED.problem, run: true },
        'runner/quit': { channel: DECLARED.quit, run: true },
    },
    told: {
        [DECLARED.stop.channel]: 'runner/stop',
    },
});

// The mods' runs, as the core decides when a mod runs: what is asked of the runs and what happens to a page is told the
// core, and what the core answers is done here in order, its runs kept as it told them so what asks at once is answered
// at once. `pages` and `app` are the environment's (environment/: MAIN.pages, MAIN.app).
export function createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: PAGES, app: APP }) {
    // MARK: - Property
    // mod id -> { mod, page, host, run, update, loadedItself, lifecycles }: a mod's sandbox, the page it runs in, what
    // hosts it, `{ load(), kill(), close() }`, a page or a transport connection that arrived from outside, its latest
    // run and how what the core and its page tell of it is kept, whether its page is loading by itself or has just
    // loaded by itself, and how many lifecycles its latest run stacks, as its page said.
    const sandboxes = new Map();
    // mod id -> its latest run that launched: kept while the mod launches again, or in a new sandbox, until it goes
    const lastLaunched = new Map();
    const reloading = new Map(); // mod id -> how many reloads are bringing it back
    const notifications = EVENT_BUS.make(); // the lifecycle's notifications, for every run
    const effectHandlers = new Map(); // effect name -> what does it, for an effect that is another module's to do
    const problemListeners = new Set(); // told when a problem is kept against a run
    const waiting = new Set(); // { done, resolve, reject }: what resolves once what the core told makes done() true
    let asked = Promise.resolve(); // settled once the core has answered all that was asked of it, and it was done
    let reconciled = Promise.resolve(); // settled once what the catalog's last change comes to has loaded
    const offered = new Map(); // a transport connection's name -> what hosts a run on it, while the core verifies it
    const sandboxListeners = new Set(); // told of each sandbox's page as it is made
    const outsideListeners = new Set(); // told of a run a transport connection hosts, as the core tells of it
    let quitHold = null; // 'held' while the runs terminate as the app quits, 'free' once nothing holds it

    // MARK: - Initializer
    // MARK: - Public
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show. The core launches the
    // background mods now. Resolves once each background mod has launched, or failed to; rejects with why the core did
    // not launch them, which is what started the runner to report.
    function start() {
        listen();
        CATALOG.onChange(reconcile);
        const launched = ask('runner/start', {}).then((effects) => {
            const launching = effects.filter(({ notification }) => notification === 'willLaunch').map(({ mod }) => mod);
            return until(() => launching.every((id) => runOf(id)?.state !== 'launching'));
        });
        reconciled = launched;
        // The app quits once every run has ended. Held as the app is about to quit, once the quit is decided, while
        // a run has not; a quit asked again meanwhile waits too. Then the quit is asked again and goes on as any quit
        // does. A quit the host app calls off leaves those runs ended, and the next quit terminates what launched
        // since. A core that cannot be asked holds nothing.
        APP.onQuit(() => {
            const live = runs().some(({ run }) => run.state !== 'notRunning');
            if (quitHold === 'free' || (!quitHold && !live)) return false;
            if (quitHold) return true;
            quitHold = 'held';
            unload([...sandboxes.keys()]).then(
                () => {
                    quitHold = null;
                    APP.quit();
                },
                (error) => {
                    LOG.error('the mods were not stopped as the app quit', error);
                    release(error);
                }
            );
            return true;
        });
        return launched;
    }

    // Each mod's latest run, with the page it runs in.
    function runs() {
        return [...sandboxes.values()].filter(({ outside }) => !outside).map(({ run, page }) => ({ run, page }));
    }

    function runOf(modId) {
        return sandboxes.get(modId)?.run || null;
    }

    function launchedOf(modId) {
        return lastLaunched.get(modId) || null;
    }

    // The run a page's message is from, while it is that mod's latest: what an older run sent before it was
    // replaced, still on its way, is not the newer one's.
    function currentRun(sender, number) {
        const run = runOf(IDENTITY.modFrom(sender).id);
        return run?.number === number ? run : null;
    }

    // `observer(run)` is told `name`, one of the lifecycle's notifications, for every run. Answers its off.
    function observe(name, observer) {
        return notifications.on(name, observer);
    }

    // A problem recorded against the run: the first one while it launches or runs is kept.
    function reportProblem(run, problem) {
        send('runner/problem', { mod: run.mod.id, run: run.number, problem });
    }

    // `listener(page, mod)` is told of each sandbox's page as it is made, once deckit knows it as the mod's and before
    // it loads, so what sets the page up is in place before the mod's code runs. Answers its off.
    function onSandbox(listener) {
        sandboxListeners.add(listener);
        return () => sandboxListeners.delete(listener);
    }

    // `listener(run)` is told of a run a transport connection hosts each time the core tells of it, its state as
    // told. Answers its off.
    function onOutside(listener) {
        outsideListeners.add(listener);
        return () => outsideListeners.delete(listener);
    }

    // Told when a problem is kept against a run. Answers its off.
    function onProblem(listener) {
        problemListeners.add(listener);
        return () => problemListeners.delete(listener);
    }

    // Resolves once what the catalog's last change comes to has loaded, or before any change the background mods: a
    // mod gone has closed, and one changed that ran has launched again, or failed to. Rejects with why it did not.
    function whenReconciled() {
        return reconciled;
    }

    // `handler(effect)` does each effect the core answers by `name` that is another module's to do.
    function handleEffect(name, handler) {
        effectHandlers.set(name, handler);
    }

    // A transport connection that arrived offers to host a run while the core verifies whose it is: `host` is
    // `{ sender, whenEnds(listener), load(), kill(), close() }`, `sender` what its messages come from. The core opens
    // the sandbox on it by the name `transport`. Answers what withdraws the offer.
    function offer(transport, host) {
        offered.set(transport, host);
        return () => offered.delete(transport);
    }

    // The mod launches as asked, and one whose run terminates once that run has ended, as the core keeps it: `by` is
    // the id of the mod that asks, which the core refuses unless it is granted deckit.mods, and with none the shell
    // asks. A launch takes the mod off the relaunch limit. One launching or running is left as it is. Resolves once it
    // has launched, or ended; rejects with what the run it asked for is refused with at launch where it did not
    // launch, and with NOT_LAUNCHED while the app quits.
    async function launch(id, by = null) {
        const quitting = () => refused('launch', 'NOT_LAUNCHED', `${id} does not launch while the app quits`);
        if (quitHold === 'held') throw quitting();
        const before = runOf(id);
        const effects = await ask('runner/launch', by ? { mod: id, by } : { mod: id });
        const launched = effects.some(({ notification, mod }) => notification === 'willLaunch' && mod === id);
        let run = launched ? runOf(id) : null;
        if (before?.state === 'terminating') {
            await until(() => before.state !== 'terminating');
            run = runOf(id) === before ? null : runOf(id);
            if (!run && quitHold === 'held') throw quitting();
        }
        await until(() => (run ?? runOf(id))?.state !== 'launching');
        if (run?.refusal) throw refused(run.refusal.stage, run.refusal.kind, run.refusal.message);
    }

    // The mods named terminate. Resolves once the run each had has ended, whether or not it launches again.
    async function unload(ids) {
        if (!ids.length) return;
        const ending = ids.map(runOf);
        await ask('runner/unload', { mods: ids });
        await until(() => ending.every((run) => (run?.state ?? 'notRunning') === 'notRunning'));
    }

    // The mod quits as asked, as `unload` ends it: `by` is the id of the mod that asks, refused as `launch` refuses
    // it, and so is an id no mod is listed under. Resolves once the run it had has ended, whether or not it launches
    // again.
    async function quit(id, by = null) {
        const ending = runOf(id);
        await ask('runner/quit', by ? { mod: id, by } : { mod: id });
        await until(() => (ending?.state ?? 'notRunning') === 'notRunning');
    }

    // The mods named terminate, or are not running, and then each launches as `launch` does, for `by`, their runs
    // saying meanwhile that they load again. Resolves once each has launched again, or failed to.
    async function relaunch(ids, by = null) {
        mark(ids, true);
        try {
            await unload(ids);
            await Promise.all(ids.map((id) => launch(id, by)));
        } finally {
            mark(ids, false);
        }
    }

    // Every mod with a sandbox terminates and loads again, and one whose run ended for a quit the host app called off
    // loads again.
    function relaunchAll() {
        const ids = [...sandboxes.keys()];
        return reload(ids, ids);
    }

    // MARK: - Private
    // A mod that arrives loads only as something asks for it, and one that leaves goes. One whose code changed goes,
    // and loads again if it ran. The core is asked first what the owners come to: a connection to a mod that no longer
    // owns its interface ends, and one to the owner now stands. Each change of the catalog comes to this on its own:
    // one that waits on a mod still launching holds up no other.
    function reconcile() {
        const current = new Map(CATALOG.mods().map((mod) => [mod.id, mod]));
        const stale = [...sandboxes.values()]
            .filter(({ mod }) => current.get(mod.id)?.revision !== mod.revision)
            .map(({ mod }) => mod.id);
        const updated = stale.filter((id) => current.has(id) && running(id));
        reconciled = ask('runner/reconnect', {}).then(() => reload(stale, updated));
        reconciled.catch((error) => LOG.error('the mods were not loaded', error));
    }

    // Each mod named loads, and one whose run terminates once that run has ended, as the core keeps it. One launching
    // or running is left as it is, one at the relaunch limit too, and none loads while the app quits. Resolves once
    // each has launched, or failed to.
    async function load(ids) {
        if (!ids.length || quitHold === 'held') return;
        const before = ids.map(runOf);
        await ask('runner/load', { mods: ids });
        await until(
            () =>
                before.every((run) => run?.state !== 'terminating') &&
                ids.every((id) => runOf(id)?.state !== 'launching')
        );
    }

    // The mods named in `unloading` unload, and then each mod in `ids` loads, the runs of those that have one saying
    // meanwhile that they load again.
    async function reload(unloading, ids) {
        mark(ids, true);
        try {
            await unload(unloading);
            await load(ids);
        } finally {
            mark(ids, false);
        }
    }

    function running(id) {
        return (runOf(id)?.state ?? 'notRunning') !== 'notRunning';
    }

    // A reload starting or ending for the mods: their latest runs say they load again while any reload is bringing
    // them back.
    function mark(ids, relaunches) {
        for (const id of new Set(ids)) {
            const count = (reloading.get(id) ?? 0) + (relaunches ? 1 : -1);
            if (count) reloading.set(id, count);
            else reloading.delete(id);
            sandboxes.get(id)?.update({ relaunches: count > 0 });
        }
    }

    // What the core answers is done before anything asked after it is. Answers what the core answered: the effects,
    // or, for a method that answers more, what `effectsOf` reads them from.
    function ask(method, params, effectsOf = (answer) => answer) {
        const answered = CORE.request(method, params).then(
            (answer) => {
                apply(effectsOf(answer));
                return answer;
            },
            (error) => {
                if (error.kind === 'ENDED') release(error);
                throw error;
            }
        );
        asked = answered.catch(() => {});
        return answered;
    }

    // A core that has ended moves no run again: what waits on it is refused with why, and it holds no quit.
    function release(error) {
        const held = quitHold === 'held';
        quitHold = 'free';
        for (const { reject } of waiting) reject(error);
        waiting.clear();
        if (held) APP.quit();
    }

    function send(method, params) {
        ask(method, params).catch((error) => LOG.error(`the core did not take ${method}`, error));
    }

    // Every effect is done: what doing one throws, a listener's throw as a run is told, is logged, once, and keeps
    // none of those after it from being done.
    function apply(effects) {
        for (const effect of effects) {
            try {
                act(effect);
            } catch (error) {
                LOG.error(`the effect ${effect.effect} was not done whole`, error);
            }
        }
        for (const wait of waiting) {
            if (!wait.done()) continue;
            waiting.delete(wait);
            wait.resolve();
        }
    }

    function act(effect) {
        switch (effect.effect) {
            case 'open':
                if (effect.transport) openOutside(effect);
                else openSandbox(MOD.read(effect.found));
                break;
            case 'loadPage':
                sandboxes.get(effect.mod).host.load();
                break;
            case 'tell':
                tell(sandboxes.get(effect.mod), effect.notification, effect);
                break;
            case 'keep':
                keep(sandboxes.get(effect.mod), effect);
                break;
            case 'stop':
                stop(effect.mod, effect.run);
                break;
            case 'kill':
                sandboxes.get(effect.mod).host.kill();
                break;
            case 'close':
                closeSandbox(effect.mod);
                break;
            default:
                effectHandlers.get(effect.effect)?.(effect);
        }
    }

    function until(done) {
        if (done()) return Promise.resolve();
        return new Promise((resolve, reject) => waiting.add({ done, resolve, reject }));
    }

    // A run is one object from willLaunch on.
    function tell(sandbox, name, told) {
        if (name === 'willLaunch') {
            const relaunches = reloading.has(sandbox.mod.id);
            Object.assign(sandbox, RUN.makeRun({ mod: sandbox.mod, number: told.run, relaunches }));
            limitLaunch(sandbox.run);
        }
        update(sandbox, told);
        const { run } = sandbox;
        // What follows the mods' runs is told of a mod's run alone: a run a transport connection hosts is no mod's.
        if (sandbox.outside) {
            for (const listener of outsideListeners) listener(run);
            return;
        }
        if (name === 'didLaunch') lastLaunched.set(run.mod.id, run);
        notifications.emit(name, run);
    }

    function keep(sandbox, told) {
        update(sandbox, told);
        if (sandbox.outside) return;
        for (const listener of problemListeners) listener(sandbox.run);
    }

    function update(sandbox, told) {
        const { state, failed, refusal = null, problem = null } = told;
        sandbox.update({ state, failed, refusal, problem });
    }

    // What the page of the mod reports of its `number`th run, kept on it while it is the mod's latest.
    function report(modId, number, properties) {
        const sandbox = sandboxes.get(modId);
        if (sandbox?.run?.number === number) sandbox.update(properties);
    }

    // What the core keeps of what a run contributes: `exportedIn` and `awaits` alone.
    function keptOf({ exportedIn, awaits }) {
        return { exportedIn, awaits };
    }

    function openSandbox(mod) {
        const sandbox = { mod, page: null, host: null, run: null, update: null, loadedItself: false, lifecycles: 1 };
        // A page that is loading by itself, or has just loaded by itself, is not loaded again: whatever run launches in
        // it meanwhile, the page takes as it asks what it runs. Killed, the page closes at once, asked nothing, and a
        // new one takes its place for the mod's next launch.
        sandbox.host = {
            load: () => {
                if (!sandbox.loadedItself) PAGES.load(sandbox.page);
            },
            kill: () => {
                PAGES.close(sandbox.page);
                makePage(sandbox);
            },
            close: () => PAGES.close(sandbox.page),
        };
        makePage(sandbox);
        sandboxes.set(mod.id, sandbox);
    }

    // The sandbox the core opened on a transport connection it verified: the connection is the principal's from now
    // on, with the permissions its job holds, and a run it hosts crashes as it closes.
    function openOutside({ mod: id, transport, permissions }) {
        const host = offered.get(transport);
        offered.delete(transport);
        const mod = Object.freeze({ id, name: id, granted: Object.freeze([...permissions]) });
        const sandbox = { mod, page: host.sender, host, outside: true, run: null, update: null, lifecycles: 1 };
        sandboxes.set(id, sandbox);
        IDENTITY.addOutside(host.sender, { mod }, host.whenEnds);
        host.whenEnds(() => crash(sandbox.run, 'its transport connection closed'));
    }

    // The sandbox's page is made, known as the mod's and set up before it loads, so what it asks as it starts is the
    // mod's. A page that did not load runs no mod: what loaded instead is never the mod's page, and the next launch
    // loads it, as it loads a page whose process ended.
    function makePage(sandbox) {
        const { mod } = sandbox;
        const page = PAGES.make({ modId: mod.id });
        sandbox.page = page;
        sandbox.loadedItself = false;
        PAGES.watch(page, {
            failed: (why) => {
                sandbox.loadedItself = false;
                crash(sandbox.run, `its page did not load (${why})`);
            },
            gone: (why) => {
                sandbox.loadedItself = false;
                crash(sandbox.run, endedProblem({ gone: why }));
            },
            consoleError: (message) => LOG.error(`${mod.id}: ${message}`),
        });
        IDENTITY.add(page, { mod });
        for (const listener of sandboxListeners) listener(page, mod);
    }

    // A run whose code has not started in the time the core gives a launch has timed out.
    function limitLaunch(run) {
        const timer = setTimeout(() => {
            if (runOf(run.mod.id) === run && run.state === 'launching')
                send('runner/timed-out', { mod: run.mod.id, run: run.number });
        }, CORE.timeout().launch);
        timer.unref?.();
    }

    function refused(stage, kind, message) {
        return Object.assign(new Error(message), { stage, kind });
    }

    // The run's end asked of what hosts it, which ends each of its lifecycles once, however often it is asked, each within
    // its own limit. The core is told once it has answered, its time ran out or the page is gone, which refuses the
    // question at once (deckit/ipc).
    function stop(modId, number) {
        const sandbox = sandboxes.get(modId);
        const stopping = sandbox
            ? PROTOCOL.stop
                  .invoke(sandbox.page, {}, { timeout: CORE.timeout().end * sandbox.lifecycles })
                  .catch(() => {})
            : Promise.resolve();
        stopping.then(() => send('runner/stopped', { mod: modId, run: number }));
    }

    // What a mod gone last launched goes with it.
    function closeSandbox(modId) {
        sandboxes.get(modId).host.close();
        sandboxes.delete(modId);
        if (!CATALOG.mods().some(({ id }) => id === modId)) lastLaunched.delete(modId);
    }

    // A crash's problem says why the page's process ended, whichever of what watches the page hears it first; a page
    // whose document was replaced, or that was destroyed, went away. `ending` is how its document ended
    // (deckit/identity).
    function endedProblem(ending) {
        return 'gone' in ending ? `its page ended (${ending.gone})` : 'its page went away';
    }

    function crash(run, problem) {
        if (!run || run.state === 'notRunning' || runOf(run.mod.id) !== run) return;
        LOG.warn(`${run.mod.id}: ${problem}`);
        send('runner/crash', { mod: run.mod.id, run: run.number, problem });
    }

    // A page that loaded again by itself runs again, in the document it loaded: the run it had ended with the document
    // it ran in. None runs again while the app quits.
    async function loadAgain(sandbox) {
        await asked;
        const { run } = sandbox;
        if (run.state === 'launching') return;
        sandbox.loadedItself = true;
        try {
            if (run.state !== 'notRunning')
                await ask('runner/crash', { mod: run.mod.id, run: run.number, problem: 'its page loaded again' });
            if (quitHold !== 'held') await ask('runner/load', { mods: [run.mod.id] });
        } finally {
            sandbox.loadedItself = false;
        }
    }

    // What a page says of its run carries the run's number. A page loaded again by itself runs nothing of the mod's
    // when its run fails as it launches. A document of a run that has not ended, replaced, is one the page loads by
    // itself: the run the crash launches, if any, runs in the document that comes, which asks what it runs.
    function listen() {
        PROTOCOL.load.handle(async (_payload, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            const sandbox = sandboxes.get(id);
            if (sandbox.run.state !== 'launching') await loadAgain(sandbox);
            sandbox.loadedItself = false;
            const { mod, run } = sandbox;
            if (run.state !== 'launching') throw Object.assign(new Error(run.problem), { kind: 'REFUSED' });
            IDENTITY.whenPageEnds(sender, (ending) => {
                const ends = runOf(id) === run && run.state !== 'notRunning';
                if (ends && ending.replaced && sandbox.page === sender) sandbox.loadedItself = true;
                crash(run, endedProblem(ending));
            });
            sandbox.lifecycles = 1;
            const source = await CATALOG.sourceOf(mod);
            const end = CORE.timeout().end;
            return { manifest: mod.manifest, granted: mod.granted, end, source, run: run.number };
        });
        PROTOCOL.described.on(({ run: number, summary, lifecycles }, sender) => {
            const sandbox = sandboxes.get(IDENTITY.modFrom(sender).id);
            if (sandbox.run.number !== number) return;
            sandbox.lifecycles = Math.max(1, lifecycles);
            sandbox.update({ summary });
        });
        PROTOCOL.started.on(({ run: number, contributions, summary }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            report(id, number, { summary, contributions });
            send('runner/started', { mod: id, run: number, contributions: keptOf(contributions) });
        });
        PROTOCOL.problem.on(({ run: number, problem }, sender) =>
            send('runner/problem', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
        PROTOCOL.notStarted.on(({ run: number, problem }, sender) =>
            send('runner/not-started', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
        // A run's own quit answers once its end is asked, not once it has ended: its code ends with it.
        PROTOCOL.quit.handle(async ({ run: number }, sender) => {
            const run = currentRun(sender, number);
            if (!run) return;
            await ask('runner/unload', { mods: [run.mod.id] }).catch((error) =>
                LOG.error(`${run.mod.id} did not quit`, error)
            );
        });
    }

    return {
        start,
        runs,
        runOf,
        launchedOf,
        currentRun,
        observe,
        reportProblem,
        ask,
        offer,
        onSandbox,
        onOutside,
        onProblem,
        handleEffect,
        whenReconciled,
        launch,
        unload,
        quit,
        relaunch,
        relaunchAll,
    };
}
