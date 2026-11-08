import * as EVENT_BUS from '../event/bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD from '../catalog/model/mod.js';
import * as RUN from './model/run.js';
import * as LIMIT from './model/limit.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' runs, as the core decides when a mod runs: what is asked of the runs and what happens to a page is told the
// core, and what the core answers is done here in order, its runs kept as it told them so what asks at once is answered
// at once. `pages` and `app` are the environment's (environment/: MAIN.pages, MAIN.app).
export function createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: PAGES, app: APP }) {
    // MARK: - Property
    // mod id -> { mod, page, run, update, loadedItself, lifecycles }: a mod's sandbox, the page it runs in, its latest
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
    let preparePage = null;
    let quitHold = null; // 'held' while the runs terminate as the app quits, 'free' once nothing holds it

    // MARK: - Initializer
    // MARK: - Public
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show. The core launches the
    // background mods now. `preparePage(page, mod)` sets the page up, once deckit knows it as the mod's. Resolves once
    // each background mod has launched, or failed to; rejects with why the core did not launch them, which is what
    // started the runner to report.
    function start({ preparePage: prepare }) {
        preparePage = prepare;
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
        return [...sandboxes.values()].map(({ run, page }) => ({ run, page }));
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

    // The mod launches as asked, once its run that terminates has ended: `by` is the id of the mod that asks, which the
    // core refuses unless it is granted deckit.mods, and with none the shell asks. A launch takes the mod off the
    // relaunch limit. One launching or running is left as it is. Resolves once it has launched, or ended; rejects with
    // what the run it asked for is refused with at launch where it did not launch, and with NOT_LAUNCHED while the app
    // quits.
    async function launch(id, by = null) {
        await until(() => quitHold === 'held' || runOf(id)?.state !== 'terminating');
        if (quitHold === 'held') throw refused('NOT_LAUNCHED', `${id} does not launch while the app quits`);
        const effects = await ask('runner/launch', by ? { mod: id, by } : { mod: id });
        const launched = effects.some(({ notification, mod }) => notification === 'willLaunch' && mod === id);
        const run = launched ? runOf(id) : null;
        await until(() => (run ?? runOf(id))?.state !== 'launching');
        if (run?.refusal) throw refused(run.refusal.kind, run.refusal.message);
    }

    // The mods named terminate. Resolves once each has ended.
    async function unload(ids) {
        if (!ids.length) return;
        await ask('runner/unload', { mods: ids });
        await until(() => ids.every((id) => (runOf(id)?.state ?? 'notRunning') === 'notRunning'));
    }

    // The mod quits as asked, as `unload` ends it: `by` is the id of the mod that asks, refused as `launch` refuses
    // it, and so is an id no mod is listed under. Resolves once it has ended.
    async function quit(id, by = null) {
        await ask('runner/quit', by ? { mod: id, by } : { mod: id });
        await until(() => (runOf(id)?.state ?? 'notRunning') === 'notRunning');
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

    // Each mod named loads, each once its own run that terminates has ended. One launching or running is left as it
    // is, one at the relaunch limit too, and none loads while the app quits. Resolves once each has launched, or
    // failed to.
    async function load(ids) {
        let left = [...new Set(ids)];
        const ready = (id) => runOf(id)?.state !== 'terminating';
        while (left.length) {
            await until(() => quitHold === 'held' || left.some(ready));
            if (quitHold === 'held') return;
            const now = left.filter(ready);
            left = left.filter((id) => !now.includes(id));
            await ask('runner/load', { mods: now });
        }
        await until(() => ids.every((id) => runOf(id)?.state !== 'launching'));
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

    // What the core answers is done before anything asked after it is. Answers the effects.
    function ask(method, params) {
        const answered = CORE.request(method, params).then(
            (effects) => {
                apply(effects);
                return effects;
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

    function apply(effects) {
        for (const effect of effects) {
            switch (effect.effect) {
                case 'open':
                    openSandbox(MOD.read(effect.found));
                    break;
                case 'loadPage':
                    loadPage(sandboxes.get(effect.mod));
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
                    kill(effect.mod);
                    break;
                case 'close':
                    closeSandbox(effect.mod);
                    break;
                default:
                    effectHandlers.get(effect.effect)?.(effect);
            }
        }
        for (const wait of waiting) {
            if (!wait.done()) continue;
            waiting.delete(wait);
            wait.resolve();
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
        if (name === 'didLaunch') lastLaunched.set(run.mod.id, run);
        notifications.emit(name, run);
    }

    function keep(sandbox, told) {
        update(sandbox, told);
        for (const listener of problemListeners) listener(sandbox.run);
    }

    function update(sandbox, told) {
        const { state, failed, refusal = null, problem = null } = told;
        sandbox.update({ state, failed, refusal, problem });
    }

    // What the page of the mod reports of its `number`th run, kept on it while it is the mod's latest.
    function reported(modId, number, facts) {
        const sandbox = sandboxes.get(modId);
        if (sandbox?.run?.number === number) sandbox.update(facts);
    }

    // What the core keeps of what a run contributes: `exportedIn` and `awaits` alone.
    function keptOf({ exportedIn, awaits }) {
        return { exportedIn, awaits };
    }

    function openSandbox(mod) {
        const sandbox = { mod, page: null, run: null, update: null, loadedItself: false, lifecycles: 1 };
        makePage(sandbox);
        sandboxes.set(mod.id, sandbox);
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
        preparePage(page, mod);
    }

    // The sandbox's page closes at once, asked nothing, and a new one takes its place for the mod's next launch.
    function kill(modId) {
        const sandbox = sandboxes.get(modId);
        PAGES.close(sandbox.page);
        makePage(sandbox);
    }

    // A run whose code has not started `LIMIT.LAUNCH_LIMIT_MS` after it launched has timed out.
    function limitLaunch(run) {
        const timer = setTimeout(() => {
            if (runOf(run.mod.id) === run && run.state === 'launching')
                send('runner/timed-out', { mod: run.mod.id, run: run.number });
        }, LIMIT.LAUNCH_LIMIT_MS);
        timer.unref?.();
    }

    function refused(kind, message) {
        return Object.assign(new Error(message), { kind });
    }

    // A page that is loading by itself, or has just loaded by itself, is not loaded again: whatever run launches in it
    // meanwhile, the page takes as it asks what it runs.
    function loadPage(sandbox) {
        if (!sandbox.loadedItself) PAGES.load(sandbox.page);
    }

    // The run's end asked of its page, which ends each of its lifecycles once, however often it is asked, each within
    // its own limit. The core is told once it has answered, its time ran out or the page is gone, which refuses the
    // question at once (deckit/ipc).
    function stop(modId, number) {
        const sandbox = sandboxes.get(modId);
        const stopping = sandbox
            ? PROTOCOL.stop
                  .invoke(sandbox.page, {}, { timeout: LIMIT.END_LIMIT_MS * sandbox.lifecycles })
                  .catch(() => {})
            : Promise.resolve();
        stopping.then(() => send('runner/stopped', { mod: modId, run: number }));
    }

    // What a mod gone last launched goes with it.
    function closeSandbox(modId) {
        PAGES.close(sandboxes.get(modId).page);
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
            return { manifest: mod.manifest, source, run: run.number };
        });
        PROTOCOL.described.on(({ run: number, summary, lifecycles }, sender) => {
            const sandbox = sandboxes.get(IDENTITY.modFrom(sender).id);
            if (sandbox.run.number !== number) return;
            sandbox.lifecycles = Math.max(1, lifecycles);
            sandbox.update({ summary });
        });
        PROTOCOL.started.on(({ run: number, contributions, summary }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            reported(id, number, { summary, contributions });
            send('runner/started', { mod: id, run: number, contributions: keptOf(contributions) });
        });
        // Joined once the core has kept what it contributes now.
        PROTOCOL.joined.on(({ run: number, contributions, summary }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            reported(id, number, { summary, contributions });
            ask('runner/joined', { mod: id, run: number, contributions: keptOf(contributions) }).then(
                () => {
                    const run = runOf(id);
                    if (run?.number === number && run.state === 'running') notifications.emit('didJoin', run);
                },
                (error) => LOG.error('the core did not take runner/joined', error)
            );
        });
        PROTOCOL.problem.on(({ run: number, problem }, sender) =>
            send('runner/problem', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
        PROTOCOL.notStarted.on(({ run: number, problem }, sender) =>
            send('runner/not-started', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
        PROTOCOL.quit.on(({ run: number }, sender) => {
            const run = currentRun(sender, number);
            if (run) unload([run.mod.id]).catch((error) => LOG.error(`${run.mod.id} did not quit`, error));
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
