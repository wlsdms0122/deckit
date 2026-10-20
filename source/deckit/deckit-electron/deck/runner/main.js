import * as EVENT_BUS from '../event/bus.js';
import * as CHANNEL from '../../../deckit-shell/deck/channel/index.js';
import * as IPC from '../../../deckit-shell/deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as ORIGIN from '../sandbox/model/origin.js';
import * as MOD from '../catalog/model/mod.js';
import * as RUN from './model/run.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' runs, as the core runs them: what happens to a page is told the core, and what the core answers is done
// here in order, its runs kept as it told them so what asks at once is answered at once.
export function createRunner({ LOG, IDENTITY, CATALOG, SANDBOX, CORE }) {
    // MARK: - Property
    // How long a mod's stop() may take before its run ends anyway.
    const STOP_LIMIT_MS = 2000;
    const ERR_ABORTED = -3;
    // mod id -> { mod, view, run, update, closing }: a mod's sandbox, the view its page is in, its latest run and how
    // what the core tells of it is kept, and whether it is going.
    const sandboxes = new Map();
    const views = new WeakMap(); // a page a mod ran in -> the view it is in, kept while the page is
    // mod id -> its latest run that launched: kept while the mod launches again, or in a new sandbox, until it goes
    const lastLaunched = new Map();
    const notifications = EVENT_BUS.make(); // the lifecycle's notifications, for every run
    const effectHandlers = new Map(); // effect name -> what does it, for an effect that is another module's to do
    const problemListeners = new Set(); // told when a problem is kept against a run
    const waiting = new Set(); // { done, resolve, reject }: what resolves once what the core told makes done() true
    let asked = Promise.resolve(); // settled once the core has answered all that was asked of it, and it was done
    let preparePage = null;
    let webPreferences = {};
    let quitHold = null; // 'held' while the runs terminate as the app quits, 'free' once nothing holds it

    // MARK: - Initializer
    // MARK: - Public
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show.
    // `preparePage(webContents, mod)` is what is on deck setting the page up, and `webPreferences` what it adds to
    // the page's preferences as the page is made.
    function start({ preparePage: prepare, webPreferences: preferences = {} }) {
        preparePage = prepare;
        webPreferences = preferences;
        listen();
        CATALOG.onChange(reconcile);
        reconcile();
        // The app quits once every run has ended. Held at will-quit, once every window has closed and the quit is
        // decided, while a run has not; a quit asked again meanwhile waits too. Then the quit is asked again and
        // goes on as any quit does, quit event and all. A quit the host app calls off leaves those runs ended, and
        // the next quit terminates what launched since. A core that cannot be asked holds nothing.
        const { app } = require('electron');
        app.on('will-quit', (event) => {
            const live = [...sandboxes.values()].some(({ run }) => run.state !== 'notRunning');
            if (quitHold === 'free' || (!quitHold && !live)) return;
            event.preventDefault();
            if (quitHold) return;
            quitHold = 'held';
            ask('runner/quit').catch((error) => {
                LOG.error('the mods were not stopped as the app quit', error);
                release(error);
            });
        });
    }

    // Each mod's latest run, with the view its page is in.
    function runs() {
        return [...sandboxes.values()].map(({ run, view }) => ({ run, view, page: view?.webContents || null }));
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
        if (held) require('electron').app.quit();
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
                    require('electron').app.quit();
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

    function openSandbox(mod) {
        const view = SANDBOX.view(webPreferences);
        const webContents = view.webContents;
        views.set(webContents, view);
        const sandbox = { mod, view, run: null, update: null, closing: false };
        // Before identity's own, so a crash ends the run with its cause. A page that did not load runs no mod:
        // what loaded instead is an error page, never the mod's origin. An aborted load is one replaced by
        // another.
        LOG.guard(webContents, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame && code !== ERR_ABORTED) crash(sandbox.run, `its page did not load (${description})`);
        });
        LOG.guard(webContents, 'render-process-gone', (_event, { reason }) =>
            crash(sandbox.run, `its page ended (${reason})`)
        );
        IDENTITY.add(webContents, { mod });
        SANDBOX.pin(webContents, ORIGIN.originOf(mod.id));
        // A page opens no window of its own: what it asked for is what is on deck's to answer.
        webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        preparePage(webContents, mod);
        SANDBOX.logConsole(webContents, mod.id);
        // It runs at full speed off screen, since the mod runs there.
        SANDBOX.keepDrawing(webContents);
        sandboxes.set(mod.id, sandbox);
    }

    function load(sandbox) {
        sandbox.view.webContents.loadURL(ORIGIN.addressOf(ORIGIN.originOf(sandbox.mod.id)));
    }

    // The mod's stop() asked of its page. The page runs it once, however often it is asked. The core is told once it
    // has answered, its time ran out or the page is gone.
    function stop(modId, number) {
        const webContents = sandboxes.get(modId)?.view.webContents;
        const stopping =
            webContents && !webContents.isDestroyed()
                ? PROTOCOL.stop.invoke(webContents, {}, { timeout: STOP_LIMIT_MS }).catch(() => {})
                : Promise.resolve();
        stopping.then(() => send('runner/stopped', { mod: modId, run: number }));
    }

    function closeSandbox(modId, reason) {
        const { view } = sandboxes.get(modId);
        if (!view.webContents.isDestroyed()) view.webContents.close();
        sandboxes.delete(modId);
        if (reason === 'removed') lastLaunched.delete(modId);
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
            IDENTITY.whenPageEnds(sender, () => crash(run, 'its page went away'));
            return {
                manifest: mod.manifest,
                source: CATALOG.sourceOf(mod),
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

    // The view a page a mod runs in, or ran in, is in.
    function viewOf(page) {
        return views.get(page) || null;
    }

    return {
        start,
        runs,
        viewOf,
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
