import * as EVENT_BUS from '../../core/event-bus/index.js';
import * as PROTOCOL from './protocol.js';
import * as ORIGIN from '../sandbox/model/origin.js';
import * as LIFECYCLE from '../mod/lifecycle.js';

export function createRunner({ STORAGE, LOG, IDENTITY, CATALOG, SANDBOX, MANIFEST }) {
    // MARK: - Property
    // How long a mod's stop() may take before its run ends anyway.
    const STOP_LIMIT_MS = 2000;
    const ERR_ABORTED = -3;
    // mod id -> { mod, view, run, stopping, closing }: a mod's sandbox, the view its page is in, kept
    // across its runs until the mod goes or its folder changes. `stopping` settles once its run's stop() has
    // answered; `closing`, once the view has closed for good.
    const sandboxes = new Map();
    const numbers = new Map(); // mod id -> the number of its latest run, counted from 1
    const notifications = EVENT_BUS.make(); // the lifecycle's notifications, for every run
    let preparePage = null;
    let quitting = null; // the runs terminating as the app quits

    // MARK: - Initializer
    // MARK: - Public
    // Every mod that loads runs in a sandbox of its own, whether or not it has anything to show.
    // `preparePage(webContents, mod)` is what is on deck setting the page up.
    function start({ preparePage: prepare }) {
        preparePage = prepare;
        listen();
        follow();
        CATALOG.onChange(reconcile);
        reconcile();
        // The app quits once every run has ended. Held at will-quit, once every window has closed and the quit is
        // decided, while a run has not; a quit asked again meanwhile waits too. Then the quit is asked again and
        // goes on as any quit does, quit event and all. A quit the host app calls off leaves those runs ended, and
        // the next quit terminates what launched since.
        const { app } = require('electron');
        app.on('will-quit', (event) => {
            const live = [...sandboxes.values()].filter(({ run }) => run.state !== 'notRunning');
            if (!quitting && !live.length) return;
            event.preventDefault();
            quitting ??= Promise.all(live.map((sandbox) => terminate(sandbox, 'quit'))).then(() => {
                quitting = null;
                app.quit();
            });
        });
    }

    // Each mod's latest run, with the view its page is in.
    function runs() {
        return [...sandboxes.values()].map(({ run, view }) => ({ run, view }));
    }

    function runOf(modId) {
        return sandboxes.get(modId)?.run || null;
    }

    // The run a page's message is from, while it is that mod's latest: what an older run sent before it was
    // replaced, still on its way, is not the newer one's.
    function currentRun(sender, number) {
        return sandboxFrom(sender, number)?.run || null;
    }

    // `observer(run)` is told `name`, one of the lifecycle's notifications, for every run. Answers its off.
    function observe(name, observer) {
        return notifications.on(name, observer);
    }

    // Resolves once the mod's sandbox that is closing has closed, and whatever runs in its place has launched.
    function whenClosed(modId) {
        return sandboxes.get(modId)?.closing || Promise.resolve();
    }

    // Every mod terminates and launches again, and a mod whose sandbox closed for a quit
    // the host app called off opens again.
    function restart() {
        for (const sandbox of sandboxes.values()) if (!sandbox.closing) relaunchSandbox(sandbox);
        reconcile();
    }

    // The mod terminates and launches again, or launches when it is not running. Throws while a mod it
    // requires is not running.
    function relaunch(modId) {
        const sandbox = sandboxes.get(modId);
        if (!sandbox || sandbox.closing || quitting) return;
        const missing = notRunningRequirement(sandbox);
        if (missing) throw new Error(`${modId} needs ${missing}, which is not running`);
        relaunchSandbox(sandbox);
    }

    // MARK: - Private
    // A mod runs only while what it requires runs: it terminates as one of them ends, before that one's stop()
    // is asked, and launches again as one of them launches. A run that crashed or did not launch ends with no
    // willTerminate.
    function follow() {
        notifications.on('willTerminate', ({ mod }) => terminateDependents(mod.id));
        notifications.on('didTerminate', ({ mod, endReason }) => !endReason && terminateDependents(mod.id));
        notifications.on('willLaunch', ({ mod }) => {
            for (const sandbox of dependentsOf(mod.id))
                if (sandbox.run.state === 'notRunning' && !sandbox.closing && !quitting) launchAgain(sandbox);
        });
    }

    function terminateDependents(modId) {
        for (const sandbox of dependentsOf(modId)) if (!sandbox.closing) terminate(sandbox, 'requirement');
    }

    function dependentsOf(modId) {
        return [...sandboxes.values()].filter(({ mod }) => Object.hasOwn(mod.requires, modId));
    }

    // The run terminates for a restart, and the mod launches again once it has ended, unless the run was given
    // a stronger reason meanwhile (a removal, a quit). One ended before launches again.
    function relaunchSandbox(sandbox) {
        const { run } = sandbox;
        const live = run.state !== 'notRunning';
        terminate(sandbox, 'restart').then(() => {
            if (quitting || sandboxes.get(sandbox.mod.id) !== sandbox || sandbox.closing) return;
            if (sandbox.run !== run || (live && !run.relaunches)) return;
            launchAgain(sandbox);
        });
    }

    // At its page's own address. While a mod it requires is not running or launching, it launches with that one.
    function launchAgain(sandbox) {
        if (notRunningRequirement(sandbox)) return;
        launch(sandbox);
        sandbox.view.webContents.loadURL(addressOf(sandbox.mod));
    }

    // The id of a mod it requires whose run is neither launching nor running, or null.
    function notRunningRequirement(sandbox) {
        const live = (id) => ['launching', 'running'].includes(sandboxes.get(id)?.run.state);
        return Object.keys(sandbox.mod.requires).find((id) => !live(id)) || null;
    }

    // A mod runs as it arrives and goes as it leaves; one whose code changed goes and runs again, once its old
    // sandbox has closed. Nothing opens while the app quits.
    function reconcile() {
        const mods = CATALOG.mods();
        for (const sandbox of sandboxes.values()) {
            if (sandbox.closing) continue;
            const found = mods.find(({ id }) => id === sandbox.mod.id);
            if (!found || found.revision !== sandbox.mod.revision) closeSandbox(sandbox, found ? 'updated' : 'removed');
        }
        if (quitting) return;
        for (const mod of mods) if (!sandboxes.has(mod.id)) openSandbox(mod);
    }

    function openSandbox(mod) {
        const view = SANDBOX.view({ webview: true });
        const webContents = view.webContents;
        const sandbox = { mod, view, run: null, stopping: null, closing: null };
        // Before identity's own, so a crash ends the run with its cause. A page that did not load runs no mod:
        // what loaded instead is an error page, never the mod's origin. An aborted load is one replaced by
        // another.
        LOG.guard(webContents, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame && code !== ERR_ABORTED)
                crash(sandbox, sandbox.run, `its page did not load (${description})`);
        });
        LOG.guard(webContents, 'render-process-gone', (_event, { reason }) =>
            crash(sandbox, sandbox.run, `its page ended (${reason})`)
        );
        IDENTITY.add(webContents, { mod });
        // A page opens no window of its own: what it asked for is what is on deck's to answer.
        webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        preparePage(webContents, mod);
        LOG.guard(
            webContents,
            'console-message',
            ({ level, message }) => level === 'error' && LOG.error(`${mod.id}: ${message}`)
        );
        // It runs at full speed off screen, since the mod runs there. Chromium takes the preference back at each
        // load, so it is given again as each one finishes.
        LOG.guard(webContents, 'did-finish-load', () => webContents.setBackgroundThrottling(false));
        sandboxes.set(mod.id, sandbox);
        launch(sandbox);
        webContents.loadURL(addressOf(mod));
    }

    // What runs in its place opens once it has closed.
    function closeSandbox(sandbox, reason) {
        sandbox.closing = terminate(sandbox, reason).then(() => {
            if (!sandbox.view.webContents.isDestroyed()) sandbox.view.webContents.close();
            sandboxes.delete(sandbox.mod.id);
            reconcile();
        });
    }

    // A run tells willLaunch as it is made, so it is the sandbox's run from the first thing it tells.
    function launch(sandbox) {
        const modId = sandbox.mod.id;
        const number = (numbers.get(modId) || 0) + 1;
        numbers.set(modId, number);
        LIFECYCLE.launch({
            mod: sandbox.mod,
            number,
            notify: (name, run) => {
                sandbox.run = run;
                notifications.emit(name, run);
            },
        });
    }

    // `reason`: one the lifecycle has. Resolves once the run has ended: its stop() answered, its time ran out or
    // its page is gone.
    function terminate(sandbox, reason) {
        const { run } = sandbox;
        if (run.state === 'notRunning') return Promise.resolve();
        const terminating = run.state === 'terminating';
        run.terminate(reason);
        return terminating ? sandbox.stopping : endAfterStop(sandbox);
    }

    // A terminating run ends once its stop() has answered, asked once every mod that requires it has ended.
    function endAfterStop(sandbox) {
        const { run, view } = sandbox;
        const dependents = dependentsOf(sandbox.mod.id).filter((dependent) => dependent.run.state === 'terminating');
        sandbox.stopping = Promise.all(dependents.map(({ stopping }) => stopping))
            .then(() => stop(view))
            .then(() => run.state === 'terminating' && run.didTerminate());
        return sandbox.stopping;
    }

    // The mod's stop() asked of its page. The page runs it once, however often it is asked. Resolves once it has
    // answered, its time ran out or the page is gone.
    function stop(view) {
        if (view.webContents.isDestroyed()) return Promise.resolve();
        return PROTOCOL.stop.invoke(view.webContents, {}, { timeout: STOP_LIMIT_MS }).catch(() => {});
    }

    function crash(sandbox, run, problem) {
        if (sandbox.run !== run || run.state === 'notRunning') return;
        LOG.warn(`${run.mod.id}: ${problem}`);
        run.crash(problem);
    }

    function addressOf(mod) {
        return ORIGIN.addressOf(ORIGIN.originOf(mod.id));
    }

    function sandboxFrom(sender, number) {
        const sandbox = sandboxes.get(IDENTITY.modFrom(sender).id);
        return sandbox?.run.number === number ? sandbox : null;
    }

    // What a page says of its run carries the run's number.
    function listen() {
        PROTOCOL.load.handle((_payload, sender) => {
            const sandbox = sandboxes.get(IDENTITY.modFrom(sender).id);
            if (sandbox.closing) throw new Error(`${sandbox.mod.id} is going`);
            // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
            // Nothing launches while the app quits, or while a mod it requires is not running.
            if (sandbox.run.state !== 'launching') {
                if (quitting) throw new Error(`${sandbox.mod.id} does not launch while the app quits`);
                const missing = notRunningRequirement(sandbox);
                if (missing) throw new Error(`${sandbox.mod.id} needs ${missing}, which is not running`);
                crash(sandbox, sandbox.run, 'its page loaded again');
                launch(sandbox);
            }
            const run = sandbox.run;
            IDENTITY.whenPageEnds(sender, () => crash(sandbox, run, 'its page went away'));
            return {
                manifest: MANIFEST.of(sandbox.mod),
                source: CATALOG.sourceOf(sandbox.mod),
                settings: STORAGE.settings.read(sandbox.mod.id),
                run: run.number,
            };
        });
        PROTOCOL.started.on(({ run: number, contributions, summary }, sender) => {
            const run = currentRun(sender, number);
            if (run?.state === 'launching') run.didLaunch({ summary, contributions });
        });
        PROTOCOL.problem.on(({ run: number, problem }, sender) => currentRun(sender, number)?.record(problem));
        PROTOCOL.notStarted.on(({ run: number, problem }, sender) => {
            const sandbox = sandboxFrom(sender, number);
            if (sandbox?.run.state !== 'launching') return;
            sandbox.run.didFailToLaunch(problem);
            endAfterStop(sandbox);
        });
    }

    return { start, runs, runOf, currentRun, observe, whenClosed, restart, relaunch };
}
