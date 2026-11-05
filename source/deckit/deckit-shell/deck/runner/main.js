import * as EVENT_BUS from '../event/bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD from '../catalog/model/mod.js';
import * as RUN from './model/run.js';
import * as LIMIT from './model/limit.js';
import * as ORIGIN from './model/origin.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' runs: which mods load or unload, and when, is decided here, and the core runs them. What happens to a page
// is told the core, and what the core answers is done here in order, its runs kept as it told them so what asks at once
// is answered at once. `pages` and `app` are the environment's (environment/: MAIN.pages, MAIN.app).
export function createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: PAGES, app: APP }) {
    // MARK: - Property
    // mod id -> { mod, page, run, update, loadedItself, lifecycles }: a mod's sandbox, the page it runs in, its latest
    // run and how what the core tells of it is kept, whether its page has just loaded by itself, and how many
    // lifecycles its latest run stacks, as its page said.
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
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show. The mods the person
    // approved to start with the app load now. `preparePage(page, mod)` is what is on deck setting the page up, once
    // deck knows it as the mod's.
    function start({ preparePage: prepare }) {
        preparePage = prepare;
        listen();
        CATALOG.onChange(reconcile);
        const startup = CATALOG.mods().filter(({ startupApproved }) => startupApproved);
        reconciled = load(
            startup.map(({ id }) => id),
            ORIGIN.STARTUP
        );
        reconciled.catch((error) => LOG.error('the startup mods were not loaded', error));
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

    // Resolves once what the catalog's last change comes to has loaded, or before any change the startup mods: a mod
    // gone has closed, and one changed that ran has launched again, or failed to. Rejects with why it did not.
    function whenReconciled() {
        return reconciled;
    }

    // `handler(effect)` does each effect the core answers by `name` that is another module's to do.
    function handleEffect(name, handler) {
        effectHandlers.set(name, handler);
    }

    // The mods named load for `origin` (model/origin.js), with the mods they require by id, for being required. See
    // `loadRequested`.
    function load(ids, origin) {
        return loadRequested(ids.map((id) => ({ id, origin })));
    }

    // The mod's run, for `origin`: as it runs, or once the mod has loaded for it and its start has ended. Rejects with
    // why it does not run, `kind` NOT_RUNNING, for a mod that does not load, failed to launch or is at the relaunch
    // limit.
    async function activate(id, origin) {
        if (runOf(id)?.state !== 'running') await load([id], origin);
        const run = runOf(id);
        if (run?.state === 'running') return run;
        const mod = CATALOG.mods().find((one) => one.id === id);
        const why = !mod
            ? 'it is not installed or does not load'
            : run?.relaunchLimited
              ? 'it failed too often in a short time, and launches again only as the person opens it'
              : run?.problem || 'it did not launch';
        throw Object.assign(new Error(`${id} is not running: ${why}`), { kind: 'NOT_RUNNING' });
    }

    // The mods named terminate, after the mods that require them. Resolves once each has ended.
    async function unload(ids) {
        if (!ids.length) return;
        await ask('runner/unload', { mods: ids });
        await until(() => ids.every((id) => (runOf(id)?.state ?? 'notRunning') === 'notRunning'));
    }

    // The mods terminate and load again as the person opens them, or load when they are not running, and the mods
    // that require them and run, or whose run ended with one of these, load again with them, as they launched. Resolves
    // once each has launched again, or failed to: one loaded while a mod it requires is not running fails as it
    // launches.
    function relaunch(ids) {
        const dependents = dependentsOf(ids, new Map(CATALOG.mods().map((mod) => [mod.id, mod])));
        const again = new Set([...ids, ...dependents]);
        const comesBack = (id) => running(id) || again.has(runOf(id)?.endedWith);
        const requested = ids.map((id) => ({ id, origin: ORIGIN.PERSON }));
        return reload(ids, [...requested, ...asLaunched(dependents.filter(comesBack))]);
    }

    // Every mod with a sandbox terminates and loads again as it launched, and one whose run ended for a quit the host
    // app called off loads again.
    function relaunchAll() {
        const ids = [...sandboxes.keys()];
        return reload(ids, asLaunched(ids));
    }

    // MARK: - Private
    // A mod that arrives loads only as something asks for it, and one that leaves goes. One whose code changed goes,
    // and loads again if it ran, with the mods that require it and ran, each as it launched. The core is asked first
    // what the owners come to: a connection to a mod that no longer owns its interface ends, and one to the owner now
    // stands. Each change of the catalog comes to this on its own: one that waits on a mod still launching holds up no
    // other.
    function reconcile() {
        const current = new Map(CATALOG.mods().map((mod) => [mod.id, mod]));
        const stale = [...sandboxes.values()]
            .filter(({ mod }) => current.get(mod.id)?.revision !== mod.revision)
            .map(({ mod }) => mod.id);
        const updated = stale.filter((id) => current.has(id) && running(id));
        const again = asLaunched([...updated, ...dependentsOf(updated, current).filter(running)]);
        reconciled = ask('runner/reconnect', {}).then(() => reload(stale, again));
        reconciled.catch((error) => LOG.error('the mods were not loaded', error));
    }

    // Each `{ id, origin }` requested loads for its origin, and the mods it requires by id for being required by it,
    // in the mods' order, each once its own run that terminates has ended and the mods it requires have launched or
    // failed to: a mod loaded while one it requires does not run fails as it launches. One launching or running is
    // left as it is, and none loads while the app quits. Resolves once each has launched, or failed to.
    async function loadRequested(requested) {
        const mods = new Map(CATALOG.mods().map((mod) => [mod.id, mod]));
        const requires = (id) =>
            (mods.get(id)?.relations ?? []).filter(({ optional }) => !optional).map(({ id }) => id);
        const origins = new Map(requested.map(({ id, origin }) => [id, origin]));
        for (const [id] of origins)
            for (const required of requires(id))
                if (!origins.has(required)) origins.set(required, ORIGIN.requiredBy(id));
        let left = [...mods.keys()].filter((id) => origins.has(id));
        const ready = (id) =>
            runOf(id)?.state !== 'terminating' &&
            requires(id).every((other) => !left.includes(other) && runOf(other)?.state !== 'launching');
        while (left.length) {
            await until(() => quitHold === 'held' || left.some(ready));
            if (quitHold === 'held') return;
            const now = left.filter(ready);
            left = left.filter((id) => !now.includes(id));
            await ask('runner/load', { requests: now.map((id) => ({ mod: id, origin: origins.get(id) })) });
        }
        await until(() => [...origins.keys()].every((id) => runOf(id)?.state !== 'launching'));
    }

    // The mods named unload, and then each `{ id, origin }` in `requested` loads, the runs of those that have one
    // saying meanwhile that they load again.
    async function reload(unloading, requested) {
        const ids = requested.map(({ id }) => id);
        mark(ids, true);
        try {
            await unload(unloading);
            await loadRequested(requested);
        } finally {
            mark(ids, false);
        }
    }

    // The mods that require the mods named, by `mods`: the catalog's mods by id.
    function dependentsOf(ids, mods) {
        return ids.flatMap((id) => mods.get(id)?.dependents ?? []);
    }

    function running(id) {
        return (runOf(id)?.state ?? 'notRunning') !== 'notRunning';
    }

    // Each mod named, requested for the origin its latest run launched for.
    function asLaunched(ids) {
        return [...new Set(ids)].map((id) => ({ id, origin: runOf(id).origin }));
    }

    // A startup mod whose run failed loads again for the startup list, with the startup mods that require it, unless
    // it reached the relaunch limit.
    function loadAgainAtStartup(run) {
        const mods = new Map(CATALOG.mods().map((mod) => [mod.id, mod]));
        const id = run.mod.id;
        if (!run.failed || run.relaunchLimited || !mods.get(id)?.startupApproved) return;
        const dependents = dependentsOf([id], mods).filter((other) => mods.get(other)?.startupApproved);
        load([id, ...dependents], ORIGIN.STARTUP).catch((error) => LOG.error(`${id} was not loaded again`, error));
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
        }
        update(sandbox, told);
        const { run } = sandbox;
        if (name === 'didLaunch') lastLaunched.set(run.mod.id, run);
        notifications.emit(name, run);
        if (name === 'didTerminate') loadAgainAtStartup(run);
    }

    function keep(sandbox, told) {
        update(sandbox, told);
        for (const listener of problemListeners) listener(sandbox.run);
    }

    function update(sandbox, told) {
        const { state, origin, failed, relaunchLimited, problem = null, endedWith = null } = told;
        const { summary = null, contributions = null } = told;
        sandbox.update({ state, origin, failed, relaunchLimited, problem, endedWith, summary, contributions });
    }

    // The page is made, known as the mod's and set up before it loads, so what it asks as it starts is the mod's. A
    // page that did not load runs no mod: what loaded instead is never the mod's page.
    function openSandbox(mod) {
        const page = PAGES.make({ modId: mod.id });
        const sandbox = { mod, page, run: null, update: null, loadedItself: false, lifecycles: 1 };
        PAGES.watch(page, {
            failed: (why) => crash(sandbox.run, `its page did not load (${why})`),
            gone: (why) => crash(sandbox.run, endedProblem({ gone: why })),
            consoleError: (message) => LOG.error(`${mod.id}: ${message}`),
        });
        IDENTITY.add(page, { mod });
        preparePage(page, mod);
        sandboxes.set(mod.id, sandbox);
    }

    // A page that has just loaded by itself is not loaded again: whatever run launches in it meanwhile, the page
    // takes as it asks what it runs.
    function loadPage(sandbox) {
        if (!sandbox.loadedItself) PAGES.load(sandbox.page);
    }

    // The run's end asked of its page, which ends each of its lifecycles once, however often it is asked, each within
    // its own limit. The core is told once it has answered, its time ran out or the page is gone, which refuses the
    // question at once (deck/ipc).
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
    // (deck/identity).
    function endedProblem(ending) {
        return 'gone' in ending ? `its page ended (${ending.gone})` : 'its page went away';
    }

    function crash(run, problem) {
        if (!run || run.state === 'notRunning' || runOf(run.mod.id) !== run) return;
        LOG.warn(`${run.mod.id}: ${problem}`);
        send('runner/crash', { mod: run.mod.id, run: run.number, problem });
    }

    // A page that loaded again by itself runs again, in the document it loaded, for the origin its run had: the run it
    // had ended with the document it ran in. None runs again while the app quits.
    async function loadAgain(sandbox) {
        await asked;
        const { run } = sandbox;
        if (run.state === 'launching') return;
        sandbox.loadedItself = true;
        try {
            if (run.state !== 'notRunning')
                await ask('runner/crash', { mod: run.mod.id, run: run.number, problem: 'its page loaded again' });
            if (quitHold !== 'held') await ask('runner/load', { requests: [{ mod: run.mod.id, origin: run.origin }] });
        } finally {
            sandbox.loadedItself = false;
        }
    }

    // What a page says of its run carries the run's number. A page loaded again by itself runs nothing of the mod's
    // when its run fails as it launches.
    function listen() {
        PROTOCOL.load.handle(async (_payload, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            const sandbox = sandboxes.get(id);
            if (sandbox.run.state !== 'launching') await loadAgain(sandbox);
            const { mod, run } = sandbox;
            if (run.state !== 'launching') throw Object.assign(new Error(run.problem), { kind: 'REFUSED' });
            IDENTITY.whenPageEnds(sender, (ending) => crash(run, endedProblem(ending)));
            sandbox.lifecycles = 1;
            const source = await CATALOG.sourceOf(mod);
            return { manifest: mod.manifest, contributes: mod.contributes, source, run: run.number };
        });
        PROTOCOL.described.on(({ run: number, summary, lifecycles }, sender) => {
            const sandbox = sandboxes.get(IDENTITY.modFrom(sender).id);
            if (sandbox.run.number === number) sandbox.lifecycles = Math.max(1, lifecycles);
            send('runner/described', { mod: sandbox.mod.id, run: number, summary });
        });
        PROTOCOL.started.on(({ run: number, contributions, summary }, sender) =>
            send('runner/started', { mod: IDENTITY.modFrom(sender).id, run: number, summary, contributions })
        );
        // Joined once the core has kept what it contributes now.
        PROTOCOL.joined.on(({ run: number, contributions, summary }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            ask('runner/joined', { mod: id, run: number, summary, contributions }).then(
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
        load,
        activate,
        unload,
        relaunch,
        relaunchAll,
    };
}
