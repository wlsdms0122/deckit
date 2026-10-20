import * as EVENT_BUS from '../event/bus.js';
import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD from '../catalog/model/mod.js';
import * as RUN from './model/run.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' runs, as the core runs them: what happens to a page is told the core, and what the core answers is done
// here in order, its runs kept as it told them so what asks at once is answered at once. `pages` and `app` are the
// environment's (environment/: MAIN.pages, MAIN.app).
export function createRunner({ LOG, IDENTITY, CATALOG, CORE, pages: PAGES, app: APP }) {
    // MARK: - Property
    // How long a mod's stop() may take before its run ends anyway.
    const STOP_LIMIT_MS = 2000;
    // mod id -> { mod, page, run, update, closing }: a mod's sandbox, the page it runs in, its latest run and how
    // what the core tells of it is kept, and whether it is going.
    const sandboxes = new Map();
    // mod id -> its latest run that launched: kept while the mod launches again, or in a new sandbox, until it goes
    const lastLaunched = new Map();
    const notifications = EVENT_BUS.make(); // the lifecycle's notifications, for every run
    const effectHandlers = new Map(); // effect name -> what does it, for an effect that is another module's to do
    const problemListeners = new Set(); // told when a problem is kept against a run
    const waiting = new Set(); // { done, resolve, reject }: what resolves once what the core told makes done() true
    let asked = Promise.resolve(); // settled once the core has answered all that was asked of it, and it was done
    let preparePage = null;
    let quitHold = null; // 'held' while the runs terminate as the app quits, 'free' once nothing holds it

    // MARK: - Initializer
    // MARK: - Public
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show.
    // `preparePage(page, mod)` is what is on deck setting the page up, once deck knows it as the mod's.
    function start({ preparePage: prepare }) {
        preparePage = prepare;
        listen();
        CATALOG.onChange(reconcile);
        reconcile();
        // The app quits once every run has ended. Held as the app is about to quit, once the quit is decided, while
        // a run has not; a quit asked again meanwhile waits too. Then the quit is asked again and goes on as any quit
        // does. A quit the host app calls off leaves those runs ended, and the next quit terminates what launched
        // since. A core that cannot be asked holds nothing.
        APP.onQuit(() => {
            const live = [...sandboxes.values()].some(({ run }) => run.state !== 'notRunning');
            if (quitHold === 'free' || (!quitHold && !live)) return false;
            if (quitHold) return true;
            quitHold = 'held';
            ask('runner/quit').catch((error) => {
                LOG.error('the mods were not stopped as the app quit', error);
                release(error);
            });
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

    // A problem against the run, which a person reads on its row: the first one while it launches or runs is kept.
    function reportProblem(run, problem) {
        send('runner/problem', { mod: run.mod.id, run: run.number, problem });
    }

    // Told when a problem is kept against a run. Answers its off.
    function onProblem(listener) {
        problemListeners.add(listener);
        return () => problemListeners.delete(listener);
    }

    // Resolves once the mod's sandbox that is closing has closed, and whatever runs in its place has opened.
    function whenClosed(modId) {
        return asked.then(() => until(() => !sandboxes.get(modId)?.closing));
    }

    // `handler(effect)` does each effect the core answers by `name` that is another module's to do.
    function handleEffect(name, handler) {
        effectHandlers.set(name, handler);
    }

    // Resolves once the mod's latest run is no longer the `run`th in `state`, as the core told it: what the core
    // answered pending on that run.
    function whenMoved({ mod, run, state }) {
        return until(() => {
            const latest = runOf(mod);
            return latest?.number !== run || latest.state !== state;
        });
    }

    function relaunchAll() {
        send('runner/relaunch-all');
    }

    // The mod terminates and launches again, or launches when it is not running. Refused while a mod it requires
    // is not running. Resolves once the run in its place has launched, or failed to.
    async function relaunch(modId) {
        const effects = await ask('runner/relaunch', { mod: modId });
        const told = effects.find((effect) => effect.effect === 'tell' && effect.mod === modId);
        const before = told?.notification === 'willLaunch' ? told.run - 1 : (told?.run ?? runOf(modId)?.number);
        return until(() => {
            const sandbox = sandboxes.get(modId);
            if (!sandbox || sandbox.closing) return true;
            const { run } = sandbox;
            return (run.number !== before || run.state === 'notRunning') && run.state !== 'launching';
        });
    }

    // MARK: - Private
    function reconcile() {
        send('runner/reconcile');
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
                case 'load':
                    load(sandboxes.get(effect.mod));
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
                case 'closing':
                    sandboxes.get(effect.mod).closing = true;
                    break;
                case 'close':
                    closeSandbox(effect.mod, effect.reason);
                    break;
                case 'quit':
                    quitHold = null;
                    APP.quit();
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
        if (name === 'willLaunch') Object.assign(sandbox, RUN.makeRun({ mod: sandbox.mod, number: told.run }));
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
        const { state, problem = null, endReason = null, relaunches, summary = null, contributions = null } = told;
        sandbox.update({ state, problem, endReason, relaunches, summary, contributions });
    }

    // The page is made, known as the mod's and set up before it loads, so what it asks as it starts is the mod's. A
    // page that did not load runs no mod: what loaded instead is never the mod's page.
    function openSandbox(mod) {
        const page = PAGES.make({ modId: mod.id });
        const sandbox = { mod, page, run: null, update: null, closing: false };
        PAGES.watch(page, {
            failed: (why) => crash(sandbox.run, `its page did not load (${why})`),
            gone: (why) => crash(sandbox.run, endedProblem({ gone: why })),
            consoleError: (message) => LOG.error(`${mod.id}: ${message}`),
        });
        IDENTITY.add(page, { mod });
        preparePage(page, mod);
        sandboxes.set(mod.id, sandbox);
    }

    function load(sandbox) {
        PAGES.load(sandbox.page);
    }

    // The mod's stop() asked of its page. The page runs it once, however often it is asked. The core is told once it
    // has answered, its time ran out or the page is gone, which refuses the question at once (deck/ipc).
    function stop(modId, number) {
        const page = sandboxes.get(modId)?.page;
        const stopping = page
            ? PROTOCOL.stop.invoke(page, {}, { timeout: STOP_LIMIT_MS }).catch(() => {})
            : Promise.resolve();
        stopping.then(() => send('runner/stopped', { mod: modId, run: number }));
    }

    function closeSandbox(modId, reason) {
        PAGES.close(sandboxes.get(modId).page);
        sandboxes.delete(modId);
        if (reason === 'removed') lastLaunched.delete(modId);
    }

    // A crash's problem says why the page's process ended, whichever of what watches the page hears it first; a page
    // whose document was replaced, or that was destroyed, went away. `ending` is how its document ended
    // (deck/identity).
    function endedProblem(ending) {
        return 'gone' in ending ? `its page ended (${ending.gone})` : 'its page went away';
    }

    function crash(run, problem) {
        if (run.state === 'notRunning' || runOf(run.mod.id) !== run) return;
        LOG.warn(`${run.mod.id}: ${problem}`);
        send('runner/crash', { mod: run.mod.id, run: run.number, problem });
    }

    // What a page says of its run carries the run's number.
    function listen() {
        PROTOCOL.load.handle(async (_payload, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            await ask('runner/load', { mod: id });
            const { mod, run } = sandboxes.get(id);
            IDENTITY.whenPageEnds(sender, (ending) => crash(run, endedProblem(ending)));
            return {
                manifest: mod.manifest,
                source: await CATALOG.sourceOf(mod),
                settings: await CORE.request('setting/read', { mod: id }),
                run: run.number,
            };
        });
        PROTOCOL.started.on(({ run: number, contributions, summary }, sender) =>
            send('runner/started', { mod: IDENTITY.modFrom(sender).id, run: number, summary, contributions })
        );
        PROTOCOL.problem.on(({ run: number, problem }, sender) =>
            send('runner/problem', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
        PROTOCOL.notStarted.on(({ run: number, problem }, sender) =>
            send('runner/not-started', { mod: IDENTITY.modFrom(sender).id, run: number, problem })
        );
    }

    return {
        start,
        runs,
        runOf,
        launchedOf,
        currentRun,
        observe,
        reportProblem,
        onProblem,
        handleEffect,
        whenMoved,
        whenClosed,
        relaunchAll,
        relaunch,
    };
}
