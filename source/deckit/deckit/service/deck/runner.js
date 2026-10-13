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
            'deckit/service/plugin/lifecycle',
        ],
        provides: ['start', 'runs', 'runOf', 'onLifecycle', 'settled', 'restart', 'pageFor'],
        runs: 'main',
    },
    (STORAGE, LOG, EVENT_BUS, IDENTITY, CATALOG, WEB, KEYMAP, OPEN, PROTOCOL, ORIGIN, LIFECYCLE) => {
        // MARK: - Property
        // How long a plugin's stop() may take before its run ends anyway.
        const STOP_LIMIT_MS = 2000;
        const ERR_ABORTED = -3;
        // plugin id -> { entry, page, run, stopping, leaving }: the page a plugin runs in, kept across its runs until
        // the plugin goes or its folder changes. `stopping` settles once its run's stop() has answered; `leaving`, once
        // the page has closed for good.
        const slots = new Map();
        const numbers = new Map(); // plugin id -> the number of its latest run, counted from 1
        const lifecycle = EVENT_BUS.make();
        let makePage = null;
        let quitting = null; // the runs terminating as the app quits

        // MARK: - Initializer
        // Every plugin that loads runs in a page of its own, whether or not it has anything to show. `makePage()` makes
        // the view a page runs in.
        function start({ makePage: make }) {
            makePage = make;
            listen();
            CATALOG.onChange(reconcile);
            reconcile();
            // The app quits once every run has ended. Held at will-quit, once every window has closed and the quit is
            // decided, while a run has not; a quit asked again meanwhile waits too. Then the quit is asked again and
            // goes on as any quit does, quit event and all. A quit the host app calls off leaves those runs ended, and
            // the next quit terminates what launched since.
            const { app } = require('electron');
            app.on('will-quit', (event) => {
                const live = [...slots.values()].filter(({ run }) => run.state !== 'notRunning');
                if (!quitting && !live.length) return;
                event.preventDefault();
                quitting ??= Promise.all(live.map((slot) => terminate(slot, 'quit'))).then(() => {
                    quitting = null;
                    app.quit();
                });
            });
        }

        // MARK: - Public
        // Each plugin's latest run, with the page it runs in.
        function runs() {
            return [...slots.values()].map(({ run, page }) => ({ run, page }));
        }

        function runOf(pluginId) {
            return slots.get(pluginId)?.run || null;
        }

        // `listener(run)` is told `name`, one of the lifecycle's notifications, for every run. Answers its off.
        function onLifecycle(name, listener) {
            if (!LIFECYCLE.NOTIFICATIONS.includes(name)) throw new Error(`no lifecycle notification ${name}`);
            return lifecycle.on(name, listener);
        }

        // Resolves once the plugin's page that is going has closed, and whatever runs in its place has launched.
        function settled(pluginId) {
            return slots.get(pluginId)?.leaving || Promise.resolve();
        }

        // Every plugin terminates and launches again in its page, at the page's own address, as a new theme asks.
        function restart() {
            for (const slot of slots.values()) {
                if (slot.leaving) continue;
                terminate(slot, 'restart').then(() => {
                    if (slots.get(slot.entry.id) !== slot || slot.leaving || slot.run.state !== 'notRunning') return;
                    launch(slot);
                    slot.page.webContents.loadURL(ORIGIN.addressOf(ORIGIN.originOf(slot.entry.id)));
                });
            }
        }

        // The deckit page a webContents belongs to: a plugin's or the switcher's own, or the plugin's that shows it as
        // a web page.
        function pageFor(webContents) {
            if (IDENTITY.pluginOf(webContents) || IDENTITY.isSwitcher(webContents)) return webContents;
            return WEB.hostOf(webContents);
        }

        // MARK: - Private
        // A plugin runs as it arrives and goes as it leaves; one whose folder changed goes and runs again, once its
        // old page has closed.
        function reconcile() {
            const plugins = CATALOG.plugins();
            for (const slot of slots.values()) {
                if (slot.leaving) continue;
                const now = plugins.find(({ id }) => id === slot.entry.id);
                if (!now || !sameFolder(slot.entry, now)) leave(slot, now ? 'updated' : 'removed');
            }
            for (const entry of plugins) if (!slots.has(entry.id)) open(entry);
        }

        function sameFolder(before, after) {
            return (
                before.folder === after.folder &&
                before.version === after.version &&
                before.installs === after.installs &&
                JSON.stringify(before.permissions) === JSON.stringify(after.permissions)
            );
        }

        function open(entry) {
            const page = makePage();
            const contents = page.webContents;
            const origin = ORIGIN.originOf(entry.id);
            const slot = { entry, page, run: null, stopping: null, leaving: null };
            // Before identity's own, so a crash ends the run with its reason. A page that did not load runs no plugin:
            // what loaded instead is an error page, never the plugin's origin. An aborted load is one replaced by
            // another.
            LOG.guard(contents, 'did-fail-load', (_event, code, description, _url, isMainFrame) => {
                if (isMainFrame && code !== ERR_ABORTED)
                    crash(slot, slot.run, `its page did not load (${description})`);
            });
            LOG.guard(contents, 'render-process-gone', (_event, { reason }) =>
                crash(slot, slot.run, `its page ended (${reason})`)
            );
            IDENTITY.add(contents, { plugin: entry });
            WEB.host(contents);
            KEYMAP.listen(contents);
            // Every scheme: which ones open, and how, is the scheme's handlers' to say.
            contents.setWindowOpenHandler((details) => {
                OPEN.open(details.url, WEB.windowOptions(details));
                return { action: 'deny' };
            });
            // Identity holds the page to its origin, and a link that leaves it is opened by the scheme's handlers.
            LOG.guard(contents, 'will-frame-navigate', (details) => {
                if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.open(details.url, {});
            });
            LOG.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${entry.id}: ${message}`)
            );
            // It runs at full speed off screen: it is the plugin running, not a tab put away. Chromium takes the
            // preference back at each load, so it is given again as each one finishes.
            LOG.guard(contents, 'did-finish-load', () => contents.setBackgroundThrottling(false));
            slots.set(entry.id, slot);
            launch(slot);
            contents.loadURL(ORIGIN.addressOf(origin));
        }

        function launch(slot) {
            const pluginId = slot.entry.id;
            const number = (numbers.get(pluginId) || 0) + 1;
            numbers.set(pluginId, number);
            slot.run = LIFECYCLE.makeRun({
                plugin: slot.entry,
                number,
                notify: (name, run) => lifecycle.emit(name, run),
            });
            slot.run.launch();
        }

        // `reason`: removed, updated, restart or quit. Resolves once the run has ended, its stop() answered, its time
        // run out or its page gone.
        function terminate(slot, reason) {
            const { run, page } = slot;
            if (run.state === 'terminating') return slot.stopping;
            if (run.state === 'notRunning') return Promise.resolve();
            run.terminate(reason);
            slot.stopping = stop(page).then(() => run.state === 'terminating' && run.didTerminate());
            return slot.stopping;
        }

        // The plugin's stop() asked of its page, which answers once whatever it is asked: resolves once it has answered,
        // its time ran out or the page is gone.
        function stop(page) {
            if (page.webContents.isDestroyed()) return Promise.resolve();
            return PROTOCOL.stop.invoke(page.webContents, {}, { timeout: STOP_LIMIT_MS }).catch(() => {});
        }

        function leave(slot, reason) {
            slot.leaving = terminate(slot, reason).then(() => {
                if (!slot.page.webContents.isDestroyed()) slot.page.webContents.close();
                slots.delete(slot.entry.id);
                reconcile();
            });
        }

        function crash(slot, run, why) {
            if (slot.run !== run || run.state === 'notRunning') return;
            LOG.warn(`${run.plugin.id}: ${why}`);
            run.crash(why);
        }

        // What a page says of its run carries the run's number: what an older run sent before it was replaced, still
        // on its way, is not the newer one's.
        function listen() {
            const runFrom = (number, sender) => {
                const run = slots.get(IDENTITY.pluginFrom(sender).id)?.run;
                return run && (number === null || number === undefined || number === run.number) ? run : null;
            };
            PROTOCOL.load.handle((_payload, sender) => {
                const slot = slots.get(IDENTITY.pluginFrom(sender).id);
                if (slot.leaving) throw new Error(`${slot.entry.id} is going`);
                // A page that loaded again by itself runs again: the run it had ended with the document it ran in.
                if (slot.run.state !== 'launching') {
                    crash(slot, slot.run, 'its page loaded again');
                    launch(slot);
                }
                const run = slot.run;
                IDENTITY.whenPageEnds(sender, () => crash(slot, run, 'its page went away'));
                return {
                    manifest: CATALOG.manifestOf(slot.entry),
                    source: CATALOG.sourceOf(slot.entry),
                    settings: STORAGE.settings.read(slot.entry.id),
                    run: run.number,
                };
            });
            PROTOCOL.started.on(({ run: number, exports, summary }, sender) => {
                const run = runFrom(number, sender);
                if (run?.state === 'launching') run.didLaunch({ summary, exports });
            });
            PROTOCOL.problem.on(({ run: number, why }, sender) => {
                const run = runFrom(number, sender);
                if (!run) return;
                LOG.warn(`${run.plugin.id}: ${why}`);
                run.record(why);
            });
            // What start() did before it failed is ended at once by stop(), as for any run that ends.
            PROTOCOL.notStarted.on(({ run: number, why }, sender) => {
                const run = runFrom(number, sender);
                if (run?.state !== 'launching') return;
                LOG.warn(`${run.plugin.id}: ${why}`);
                run.didFailToLaunch(why);
                stop(slots.get(run.plugin.id).page);
            });
        }

        return { start, runs, runOf, onLifecycle, settled, restart, pageFor };
    }
);
