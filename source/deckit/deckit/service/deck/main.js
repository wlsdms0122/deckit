DeckitModule.define(
    'deckit/service/deck/main',
    {
        uses: [
            'deckit/service/storage',
            'deckit/service/web/session',
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/deck/install',
            'deckit/service/deck/remove',
            'deckit/service/deck/catalog',
            'deckit/service/deck/main-process',
            'deckit/service/deck/record',
            'deckit/service/deck/setting',
            'deckit/service/deck/export',
            'deckit/service/deck/protocol',
        ],
        provides: ['start', 'prepare', 'rerun', 'summaryOf', 'hasStarted', 'hasEnded', 'ended', 'onStatus'],
        runs: 'main',
    },
    (STORAGE, SESSION, LOG, IDENTITY, INSTALL, REMOVE, CATALOG, MAIN_PROCESS, RECORD, SETTING, EXPORT, PROTOCOL) => {
        // MARK: - Property
        const started = new Map(); // plugin id -> what it said it contributes
        const failures = new Map(); // plugin id -> the first reason recorded against it
        const stopped = new Set(); // plugin ids that ended without starting
        const runs = new Map(); // plugin id -> which run of its page this is, counted from 1
        const starting = new Set(); // plugin ids whose current run has not started yet
        const statusListeners = new Set();

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            forgetRemoved();
            MAIN_PROCESS.start();
            RECORD.start();
            SETTING.start({ ordered: () => CATALOG.plugins().map(({ id }) => id) });
            EXPORT.start();
            CATALOG.start();
            listen();
        }

        // Before a plugin's page is made: whoever requires it told to wait.
        function prepare(entry) {
            started.delete(entry.id);
            rerun(entry.id);
            MAIN_PROCESS.prepare(entry);
        }

        // Before the same plugin's page runs again (a new theme): whoever requires it waits for the new run, what it
        // said it contributes and its settings stand until the new run says them again, and its main process modules
        // keep running.
        function rerun(pluginId) {
            runs.set(pluginId, (runs.get(pluginId) || 0) + 1);
            starting.add(pluginId);
            failures.delete(pluginId);
            stopped.delete(pluginId);
            EXPORT.expect(pluginId);
        }

        // What a running plugin said it contributes as it started, or null before.
        function summaryOf(pluginId) {
            return started.get(pluginId) || null;
        }

        // Whether the plugin's current run has started, and not ended.
        function hasStarted(pluginId) {
            return started.has(pluginId) && !starting.has(pluginId);
        }

        // Whether a plugin ended: it never started, or its page went.
        function hasEnded(pluginId) {
            return stopped.has(pluginId);
        }

        // A plugin that is no longer running in its page, or never started there: whoever requires it is told.
        function ended(pluginId, why) {
            record(pluginId, why);
            EXPORT.fail(pluginId, why);
            SETTING.forget(pluginId);
            started.delete(pluginId);
            stopped.add(pluginId);
            for (const listener of statusListeners) listener(pluginId);
        }

        // Told each time a plugin has started, or ended.
        function onStatus(listener) {
            statusListeners.add(listener);
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.load.handle((_payload, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                const run = runs.get(plugin.id);
                // Whoever requires it waits until it has started, so a page that goes first answers them too. A run
                // replaced by a newer one (a new page, or the same page run again) fails nothing of the newer one.
                IDENTITY.whenPageEnds(
                    sender,
                    () => runs.get(plugin.id) === run && EXPORT.fail(plugin.id, 'its page went away before it started')
                );
                return loadOf(plugin);
            });
            // What an older run sent before it was replaced, still on its way, is not this run's.
            const current = (run, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                return run === null || run === undefined || run === runs.get(plugin.id) ? plugin : null;
            };
            PROTOCOL.declare.on(({ run, settings }, sender) => {
                const plugin = current(run, sender);
                if (plugin) SETTING.declare(plugin, settings);
            });
            PROTOCOL.started.on(({ run, exports, summary }, sender) => {
                const plugin = current(run, sender);
                if (!plugin) return;
                EXPORT.provide(plugin.id, exports);
                started.set(plugin.id, summary);
                starting.delete(plugin.id);
                for (const listener of statusListeners) listener(plugin.id);
            });
            PROTOCOL.failed.on(({ run, why }, sender) => {
                const plugin = current(run, sender);
                if (plugin) record(plugin.id, why);
            });
            PROTOCOL.stopped.on(({ run, why }, sender) => {
                const plugin = current(run, sender);
                if (plugin) ended(plugin.id, why);
            });
            PROTOCOL.plugins.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return describe();
            });
            PROTOCOL.pick.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return pick();
            });
            PROTOCOL.install.handle(({ from }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return install(from);
            });
            PROTOCOL.remove.handle(({ id, data }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return remove(id, data);
            });
            PROTOCOL.reveal.handle(({ id }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                const entry = CATALOG.entries().find((candidate) => candidate.id === id);
                if (!entry) throw new Error('no plugin ' + id);
                return require('electron').shell.openPath(entry.folder);
            });
            PROTOCOL.count.handle(({ id }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return STORAGE.count(id);
            });
            PROTOCOL.restartPending.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return MAIN_PROCESS.restartPending();
            });
        }

        function loadOf(plugin) {
            const entry = CATALOG.entries().find((candidate) => candidate.id === plugin.id);
            return {
                manifest: CATALOG.manifestOf(entry),
                source: CATALOG.sourceOf(entry),
                settings: STORAGE.settings.read(entry.id),
                run: runs.get(plugin.id),
            };
        }

        function record(pluginId, why) {
            LOG.warn(`${pluginId}: ${why}`);
            if (!failures.has(pluginId)) failures.set(pluginId, why);
        }

        // What Settings shows about every plugin, loaded or not, and what each running one contributes. `starting`: its
        // start() has not settled. `hides`: folders of the same id that are not read.
        function describe() {
            return {
                installed: CATALOG.entries().map((entry) => ({
                    ...CATALOG.manifestOf(entry),
                    folder: entry.folder,
                    installed: entry.installed,
                    shipped: entry.shipped,
                    hides: entry.hides,
                    problem: entry.problem || failures.get(entry.id) || null,
                    starting: !entry.problem && starting.has(entry.id) && !stopped.has(entry.id),
                    mainProcess: { running: MAIN_PROCESS.running(entry.id), failure: MAIN_PROCESS.failure(entry.id) },
                    requirements: entry.requirements.map((requirement) => ({
                        ...requirement,
                        ok: requirement.ok && started.has(requirement.id),
                    })),
                })),
                running: CATALOG.plugins()
                    .filter((entry) => started.has(entry.id))
                    .map((entry) => ({
                        id: entry.id,
                        name: entry.name,
                        ...started.get(entry.id),
                        problem: failures.get(entry.id) || null,
                    })),
            };
        }

        // Picking and installing are two calls because the person is asked in between. A refused folder is refused
        // before they are asked about it.
        async function pick() {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                title: 'Choose a plugin folder',
                buttonLabel: 'Choose',
                properties: ['openDirectory'],
                message: 'Pick the folder that has manifest.toml in it',
            });
            if (result.canceled || !result.filePaths[0]) return null;
            const from = result.filePaths[0];
            const manifest = INSTALL.installable(from, shadowed);
            return {
                ...CATALOG.manifestOf(manifest),
                from,
                replaces: CATALOG.entries().some((entry) => entry.id === manifest.id && entry.installed),
            };
        }

        // Any folder, since a plugin may already run code in this process: restricting where it comes from guards
        // nothing.
        async function install(from) {
            const manifest = INSTALL.install(from, shadowed);
            MAIN_PROCESS.restartFor(manifest.id);
            await CATALOG.refresh({ installed: manifest.id });
            return {
                ...CATALOG.manifestOf(manifest),
                restart: MAIN_PROCESS.restartPending().some(({ id }) => id === manifest.id),
            };
        }

        // A source folder of the same id would hide the installed copy.
        function shadowed(manifest) {
            const source = CATALOG.entries().find((entry) => entry.id === manifest.id && !entry.installed);
            return source ? `${manifest.id} is read from ${source.folder}, which would hide the installed copy` : '';
        }

        // Its sandbox has ended, stop() and all, before what it stored is taken, so nothing writes it back.
        async function remove(id, data) {
            const entry = CATALOG.entries().find((candidate) => candidate.id === id);
            if (entry && !entry.installed)
                throw new Error(`${id} is read from ${entry.folder}, not installed, so it is removed there`);
            REMOVE.remove(id);
            MAIN_PROCESS.unload(id);
            SETTING.forget(id);
            await CATALOG.refresh();
            const removed = { data: data && REMOVE.forgetData(id) };
            if (removed.data) await forget(id);
            return removed;
        }

        // A plugin removed with its data, whose pages' storage and sessions were not cleared then: cleared here.
        function forgetRemoved() {
            for (const id of REMOVE.forgotten()) {
                forget(id).catch((error) => LOG.warn(`could not clear the web storage of ${id}`, error));
            }
        }

        // The record that it is to be cleared goes only once it is, so a failure is tried again at the next start.
        async function forget(id) {
            await SESSION.forget(id);
            REMOVE.clearForgotten(id);
        }

        return { start, prepare, rerun, summaryOf, hasStarted, hasEnded, ended, onStatus };
    }
);
