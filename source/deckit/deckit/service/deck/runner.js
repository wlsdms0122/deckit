DeckitModule.define(
    'deckit/service/deck/runner',
    {
        uses: [
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/module/event-bus',
            'deckit/service/deck/identity',
            'deckit/service/deck/catalog',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/service/deck/protocol',
            'deckit/service/deck/model/origin',
            'deckit/service/plugin/manifest',
            'deckit/service/plugin/lifecycle',
        ],
        provides: ['start', 'runs', 'runOf', 'currentRun', 'observe', 'whenClosed', 'restart', 'relaunch'],
        runs: 'main',
    },
    (STORAGE, LOG, EVENT_BUS, IDENTITY, CATALOG, WEB, KEYMAP, OPEN, PROTOCOL, ORIGIN, MANIFEST, LIFECYCLE) => {
        // MARK: - Property
        // How long a plugin's stop() may take before its run ends anyway.
        const STOP_LIMIT_MS = 2000;
        const ERR_ABORTED = -3;
        // plugin id -> { plugin, view, run, stopping, closing }: a plugin's sandbox, the view its page is in, kept
        // across its runs until the plugin goes or its folder changes. `stopping` settles once its run's stop() has
        // answered; `closing`, once the view has closed for good.
        const sandboxes = new Map();
        const numbers = new Map(); // plugin id -> the number of its latest run, counted from 1
        const notifications = EVENT_BUS.make(); // the lifecycle's notifications, for every run
        let makeView = null;
        let quitting = null; // the runs terminating as the app quits

        // MARK: - Initializer
        // MARK: - Public
        // Every plugin that loads runs in a sandbox of its own, whether or not it has anything to show. `makeView()`
        // makes the view its page is in.
        function start({ makeView: make }) {
            makeView = make;
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

        // Each plugin's latest run, with the view its page is in.
        function runs() {
            return [...sandboxes.values()].map(({ run, view }) => ({ run, view }));
        }

        function runOf(pluginId) {
            return sandboxes.get(pluginId)?.run || null;
        }

        // The run a page's message is from, while it is that plugin's latest: what an older run sent before it was
        // replaced, still on its way, is not the newer one's.
        function currentRun(sender, number) {
            return sandboxFrom(sender, number)?.run || null;
        }

        // `observer(run)` is told `name`, one of the lifecycle's notifications, for every run. Answers its off.
        function observe(name, observer) {
            return notifications.on(name, observer);
        }

        // Resolves once the plugin's sandbox that is closing has closed, and whatever runs in its place has launched.
        function whenClosed(pluginId) {
            return sandboxes.get(pluginId)?.closing || Promise.resolve();
        }

        // Every plugin terminates and launches again, as a new theme asks, and a plugin whose sandbox closed for a quit
        // the host app called off opens again.
        function restart() {
            for (const sandbox of sandboxes.values()) if (!sandbox.closing) relaunchSandbox(sandbox);
            reconcile();
        }

        // The plugin terminates and launches again, or launches when it is not running. Throws while a plugin it
        // requires is not running.
        function relaunch(pluginId) {
            const sandbox = sandboxes.get(pluginId);
            if (!sandbox || sandbox.closing || quitting) return;
            const missing = notRunningRequirement(sandbox);
            if (missing) throw new Error(`${pluginId} needs ${missing}, which is not running`);
            relaunchSandbox(sandbox);
        }

        // MARK: - Private
        // A plugin runs only while what it requires runs: it terminates as one of them ends, before that one's stop()
        // is asked, and launches again as one of them launches. A run that crashed or did not launch ends with no
        // willTerminate.
        function follow() {
            notifications.on('willTerminate', ({ plugin }) => relaunchDependents(plugin.id));
            notifications.on('didTerminate', ({ plugin, endReason }) => !endReason && relaunchDependents(plugin.id));
            notifications.on('willLaunch', ({ plugin }) => {
                for (const sandbox of dependentsOf(plugin.id))
                    if (sandbox.run.state === 'notRunning' && !sandbox.closing && !quitting) launchAgain(sandbox);
            });
        }

        function relaunchDependents(pluginId) {
            for (const sandbox of dependentsOf(pluginId))
                if (sandbox.run.state !== 'notRunning' && !sandbox.closing) relaunchSandbox(sandbox);
        }

        function dependentsOf(pluginId) {
            return [...sandboxes.values()].filter(({ plugin }) => Object.hasOwn(plugin.requires, pluginId));
        }

        // The run terminates for a restart, and the plugin launches again once it has ended, unless the run was given
        // a stronger reason meanwhile (a removal, a quit). One ended before launches again.
        function relaunchSandbox(sandbox) {
            const { run } = sandbox;
            const live = run.state !== 'notRunning';
            terminate(sandbox, 'restart').then(() => {
                if (quitting || sandboxes.get(sandbox.plugin.id) !== sandbox || sandbox.closing) return;
                if (sandbox.run !== run || (live && !run.relaunches)) return;
                launchAgain(sandbox);
            });
        }

        // At its page's own address. While a plugin it requires is not running or launching, it launches with that one.
        function launchAgain(sandbox) {
            if (notRunningRequirement(sandbox)) return;
            launch(sandbox);
            sandbox.view.webContents.loadURL(addressOf(sandbox.plugin));
        }

        // The id of a plugin it requires whose run is neither launching nor running, or null.
        function notRunningRequirement(sandbox) {
            const live = (id) => ['launching', 'running'].includes(sandboxes.get(id)?.run.state);
            return Object.keys(sandbox.plugin.requires).find((id) => !live(id)) || null;
        }

        // A plugin runs as it arrives and goes as it leaves; one whose code changed goes and runs again, once its old
        // sandbox has closed. Nothing opens while the app quits.
        function reconcile() {
            const plugins = CATALOG.plugins();
            for (const sandbox of sandboxes.values()) {
                if (sandbox.closing) continue;
                const found = plugins.find(({ id }) => id === sandbox.plugin.id);
                if (!found || found.revision !== sandbox.plugin.revision)
                    closeSandbox(sandbox, found ? 'updated' : 'removed');
            }
            if (quitting) return;
            for (const plugin of plugins) if (!sandboxes.has(plugin.id)) openSandbox(plugin);
        }

        function openSandbox(plugin) {
            const view = makeView();
            const webContents = view.webContents;
            const origin = ORIGIN.originOf(plugin.id);
            const sandbox = { plugin, view, run: null, stopping: null, closing: null };
            // Before identity's own, so a crash ends the run with its cause. A page that did not load runs no plugin:
            // what loaded instead is an error page, never the plugin's origin. An aborted load is one replaced by
            // another.
            LOG.guard(webContents, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
                if (isMainFrame && code !== ERR_ABORTED)
                    crash(sandbox, sandbox.run, `its page did not load (${description})`);
            });
            LOG.guard(webContents, 'render-process-gone', (_event, { reason }) =>
                crash(sandbox, sandbox.run, `its page ended (${reason})`)
            );
            IDENTITY.add(webContents, { plugin });
            WEB.host(webContents);
            KEYMAP.listen(webContents);
            // Every scheme: which ones open, and how, is the scheme's handlers' to say.
            webContents.setWindowOpenHandler((details) => {
                OPEN.open(details.url, WEB.windowOptions(details));
                return { action: 'deny' };
            });
            // Identity holds the page to its origin, and a link that leaves it is opened by the scheme's handlers.
            LOG.guard(webContents, 'will-frame-navigate', (details) => {
                if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.open(details.url, {});
            });
            LOG.guard(
                webContents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${plugin.id}: ${message}`)
            );
            // It runs at full speed off screen, since the plugin runs there. Chromium takes the preference back at each
            // load, so it is given again as each one finishes.
            LOG.guard(webContents, 'did-finish-load', () => webContents.setBackgroundThrottling(false));
            sandboxes.set(plugin.id, sandbox);
            launch(sandbox);
            webContents.loadURL(addressOf(plugin));
        }

        // What runs in its place opens once it has closed.
        function closeSandbox(sandbox, reason) {
            sandbox.closing = terminate(sandbox, reason).then(() => {
                if (!sandbox.view.webContents.isDestroyed()) sandbox.view.webContents.close();
                sandboxes.delete(sandbox.plugin.id);
                reconcile();
            });
        }

        // A run tells willLaunch as it is made, so it is the sandbox's run from the first thing it tells.
        function launch(sandbox) {
            const pluginId = sandbox.plugin.id;
            const number = (numbers.get(pluginId) || 0) + 1;
            numbers.set(pluginId, number);
            LIFECYCLE.launch({
                plugin: sandbox.plugin,
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

        // A terminating run ends once its stop() has answered, asked once every plugin that requires it has ended.
        function endAfterStop(sandbox) {
            const { run, view } = sandbox;
            const dependents = dependentsOf(sandbox.plugin.id).filter(
                (dependent) => dependent.run.state === 'terminating'
            );
            sandbox.stopping = Promise.all(dependents.map(({ stopping }) => stopping))
                .then(() => stop(view))
                .then(() => run.state === 'terminating' && run.didTerminate());
            return sandbox.stopping;
        }

        // The plugin's stop() asked of its page. The page runs it once, however often it is asked. Resolves once it has
        // answered, its time ran out or the page is gone.
        function stop(view) {
            if (view.webContents.isDestroyed()) return Promise.resolve();
            return PROTOCOL.stop.invoke(view.webContents, {}, { timeout: STOP_LIMIT_MS }).catch(() => {});
        }

        function crash(sandbox, run, problem) {
            if (sandbox.run !== run || run.state === 'notRunning') return;
            LOG.warn(`${run.plugin.id}: ${problem}`);
            run.crash(problem);
        }

        function addressOf(plugin) {
            return ORIGIN.addressOf(ORIGIN.originOf(plugin.id));
        }

        function sandboxFrom(sender, number) {
            const sandbox = sandboxes.get(IDENTITY.pluginFrom(sender).id);
            return sandbox?.run.number === number ? sandbox : null;
        }

        // What a page says of its run carries the run's number.
        function listen() {
            PROTOCOL.load.handle((_payload, sender) => {
                const sandbox = sandboxes.get(IDENTITY.pluginFrom(sender).id);
                if (sandbox.closing) throw new Error(`${sandbox.plugin.id} is going`);
                // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
                // Nothing launches while the app quits, or while a plugin it requires is not running.
                if (sandbox.run.state !== 'launching') {
                    if (quitting) throw new Error(`${sandbox.plugin.id} does not launch while the app quits`);
                    crash(sandbox, sandbox.run, 'its page loaded again');
                    const missing = notRunningRequirement(sandbox);
                    if (missing) throw new Error(`${sandbox.plugin.id} needs ${missing}, which is not running`);
                    launch(sandbox);
                }
                const run = sandbox.run;
                IDENTITY.whenPageEnds(sender, () => crash(sandbox, run, 'its page went away'));
                return {
                    manifest: MANIFEST.of(sandbox.plugin),
                    source: CATALOG.sourceOf(sandbox.plugin),
                    settings: STORAGE.settings.read(sandbox.plugin.id),
                    run: run.number,
                };
            });
            PROTOCOL.started.on(({ run: number, exports, summary }, sender) => {
                const run = currentRun(sender, number);
                if (run?.state === 'launching') run.didLaunch({ summary, exports });
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
);
