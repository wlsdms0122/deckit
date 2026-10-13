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
        provides: ['start', 'runs', 'runOf', 'observe', 'closed', 'restart'],
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

        // `observer(run)` is told `name`, one of the lifecycle's notifications, for every run. Answers its off.
        function observe(name, observer) {
            return notifications.on(name, observer);
        }

        // Resolves once the plugin's sandbox that is closing has closed, and whatever runs in its place has launched.
        function closed(pluginId) {
            return sandboxes.get(pluginId)?.closing || Promise.resolve();
        }

        // Every plugin terminates and launches again in its sandbox, at its page's own address, as a new theme asks.
        function restart() {
            for (const sandbox of sandboxes.values()) {
                if (sandbox.closing) continue;
                terminate(sandbox, 'restart').then(() => {
                    if (sandboxes.get(sandbox.plugin.id) !== sandbox || sandbox.closing) return;
                    if (sandbox.run.state !== 'notRunning') return;
                    launch(sandbox);
                    sandbox.view.webContents.loadURL(addressOf(sandbox.plugin));
                });
            }
        }

        // MARK: - Private
        // A plugin runs as it arrives and goes as it leaves; one whose folder changed goes and runs again, once its
        // old sandbox has closed.
        function reconcile() {
            const plugins = CATALOG.plugins();
            for (const sandbox of sandboxes.values()) {
                if (sandbox.closing) continue;
                const found = plugins.find(({ id }) => id === sandbox.plugin.id);
                if (!found || !sameFolder(sandbox.plugin, found)) closeSandbox(sandbox, found ? 'updated' : 'removed');
            }
            for (const plugin of plugins) if (!sandboxes.has(plugin.id)) openSandbox(plugin);
        }

        function sameFolder(before, after) {
            return (
                before.folder === after.folder &&
                before.version === after.version &&
                before.installs === after.installs &&
                JSON.stringify(before.permissions) === JSON.stringify(after.permissions)
            );
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

        function closeSandbox(sandbox, reason) {
            sandbox.closing = terminate(sandbox, reason).then(() => {
                if (!sandbox.view.webContents.isDestroyed()) sandbox.view.webContents.close();
                sandboxes.delete(sandbox.plugin.id);
                reconcile();
            });
        }

        function launch(sandbox) {
            const pluginId = sandbox.plugin.id;
            const number = (numbers.get(pluginId) || 0) + 1;
            numbers.set(pluginId, number);
            sandbox.run = LIFECYCLE.makeRun({
                plugin: sandbox.plugin,
                number,
                notify: (name, run) => notifications.emit(name, run),
            });
            sandbox.run.launch();
        }

        // `reason`: removed, updated, restart or quit. Resolves once the run has ended, its stop() answered, its time
        // run out or its page gone.
        function terminate(sandbox, reason) {
            const { run, view } = sandbox;
            if (run.state === 'terminating') return sandbox.stopping;
            if (run.state === 'notRunning') return Promise.resolve();
            run.terminate(reason);
            sandbox.stopping = stop(view).then(() => run.state === 'terminating' && run.didTerminate());
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

        // What a page says of its run carries the run's number: what an older run sent before it was replaced, still
        // on its way, is not the newer one's.
        function listen() {
            const runFrom = (number, sender) => {
                const run = sandboxes.get(IDENTITY.pluginFrom(sender).id)?.run;
                return run && (number === null || number === undefined || number === run.number) ? run : null;
            };
            PROTOCOL.load.handle((_payload, sender) => {
                const sandbox = sandboxes.get(IDENTITY.pluginFrom(sender).id);
                if (sandbox.closing) throw new Error(`${sandbox.plugin.id} is going`);
                // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
                if (sandbox.run.state !== 'launching') {
                    crash(sandbox, sandbox.run, 'its page loaded again');
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
                const run = runFrom(number, sender);
                if (run?.state === 'launching') run.didLaunch({ summary, exports });
            });
            PROTOCOL.problem.on(({ run: number, problem }, sender) => {
                const run = runFrom(number, sender);
                if (!run) return;
                LOG.warn(`${run.plugin.id}: ${problem}`);
                run.record(problem);
            });
            // What start() did before it failed is ended at once by stop(), as for any run that ends.
            PROTOCOL.notStarted.on(({ run: number, problem }, sender) => {
                const run = runFrom(number, sender);
                if (run?.state !== 'launching') return;
                LOG.warn(`${run.plugin.id}: ${problem}`);
                run.didFailToLaunch(problem);
                stop(sandboxes.get(run.plugin.id).view);
            });
        }

        return { start, runs, runOf, observe, closed, restart };
    }
);
