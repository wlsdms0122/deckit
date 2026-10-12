DeckitModule.define(
    'deckit/service/plugin/deck',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/web/session',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/package/folder',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/package/remove',
            'deckit/service/plugin/deck/catalog',
            'deckit/service/plugin/deck/main-process',
            'deckit/service/plugin/deck/record',
            'deckit/service/plugin/deck/setting',
            'deckit/service/plugin/deck/export',
            'deckit/service/plugin/deck/protocol',
        ],
        provides: [
            'start',
            'plugins',
            'prepare',
            'rerun',
            'summaryOf',
            'failed',
            'ended',
            'onChange',
            'onStatus',
            'order',
            'arrange',
        ],
        runs: 'main',
    },
    (
        CONFIG,
        STORAGE,
        SESSION,
        LOG,
        IDENTITY,
        FOLDER,
        INSTALL,
        REMOVE,
        CATALOG,
        MAIN_PROCESS,
        RECORD,
        SETTING,
        EXPORT,
        PROTOCOL
    ) => {
        // MARK: - Property
        const ORDER = 'plugin-order';
        let entries = [];
        let shipped = []; // the ids of what the app ships, in its order
        const started = new Map(); // plugin id -> what it said it contributes
        const failures = new Map(); // plugin id -> the first reason recorded against it
        const stopped = new Set(); // plugin ids that ended without starting
        const runs = new Map(); // plugin id -> which run of its page this is, counted from 1
        // plugin id -> how many times it was installed while deckit ran: a copy of the same version is new code too
        const installs = new Map();
        const listeners = new Set();
        const statusListeners = new Set();

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            forgetRemoved();
            MAIN_PROCESS.start();
            RECORD.start();
            SETTING.start({ ordered: () => plugins().map(({ id }) => id) });
            EXPORT.start();
            shipped = CONFIG.ship.map((folder) => FOLDER.idOf(folder));
            entries = catalog();
            for (const entry of entries) if (entry.problem) LOG.warn(`plugin ${entry.id} not loaded: ${entry.problem}`);
            listen();
        }

        // The plugins that load, in the person's order.
        function plugins() {
            return arranged(entries.filter((entry) => !entry.problem));
        }

        // Before a plugin's page is made: whoever requires it told to wait.
        function prepare(entry) {
            started.delete(entry.id);
            rerun(entry.id);
            MAIN_PROCESS.prepare(entry);
        }

        // Before the same plugin's page runs again (a new theme): what it contributes stands until the new run says
        // it again, and its main process modules keep running.
        function rerun(pluginId) {
            runs.set(pluginId, (runs.get(pluginId) || 0) + 1);
            failures.delete(pluginId);
            stopped.delete(pluginId);
            EXPORT.expect(pluginId);
        }

        // What a running plugin said it contributes as it started, or null before.
        function summaryOf(pluginId) {
            return started.get(pluginId) || null;
        }

        function onChange(listener) {
            listeners.add(listener);
        }

        // Whether a plugin ended: it never started, or its page went.
        function failed(pluginId) {
            return stopped.has(pluginId);
        }

        // A plugin that is no longer running in its page, or never started there: whoever requires it is told.
        function ended(pluginId, why) {
            record(pluginId, why);
            EXPORT.fail(pluginId, why);
            started.delete(pluginId);
            stopped.add(pluginId);
            for (const listener of statusListeners) listener(pluginId);
        }

        // Told each time a plugin has started, or ended.
        function onStatus(listener) {
            statusListeners.add(listener);
        }

        function order() {
            return STORAGE.state.read(ORDER, []);
        }

        // The ids named take the places they held among themselves, in the order given; the rest stay put.
        function arrange(ids) {
            const now = plugins().map(({ id }) => id);
            const moved = [...new Set(ids)].filter((id) => now.includes(id));
            const slots = now.map((id, index) => (moved.includes(id) ? index : -1)).filter((index) => index >= 0);
            slots.forEach((slot, index) => (now[slot] = moved[index]));
            STORAGE.state.write(ORDER, now);
            notify();
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
            PROTOCOL.started.on(({ settings, exports, summary }, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                SETTING.declare(plugin, settings);
                EXPORT.provide(plugin.id, exports);
                started.set(plugin.id, summary);
                for (const listener of statusListeners) listener(plugin.id);
            });
            PROTOCOL.failed.on(({ why }, sender) => record(IDENTITY.pluginFrom(sender).id, why));
            PROTOCOL.stopped.on(({ why }, sender) => ended(IDENTITY.pluginFrom(sender).id, why));
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
                const entry = entries.find((candidate) => candidate.id === id);
                if (!entry) throw new Error('no plugin folder named ' + id);
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
            const entry = entries.find((candidate) => candidate.id === plugin.id);
            return {
                manifest: publicOf(entry),
                source: CATALOG.sourceOf(entry),
                settings: STORAGE.settings.read(entry.id),
            };
        }

        function record(pluginId, why) {
            LOG.warn(`${pluginId}: ${why}`);
            if (!failures.has(pluginId)) failures.set(pluginId, why);
        }

        // What Settings shows about every plugin folder, loaded or not, and what each running one contributes.
        function describe() {
            return {
                installed: entries.map((entry) => ({
                    ...publicOf(entry),
                    folder: entry.folder,
                    installed: entry.installed,
                    shipped: entry.shipped,
                    problem: entry.problem || failures.get(entry.id) || null,
                    mainProcess: { running: MAIN_PROCESS.running(entry.id), failure: MAIN_PROCESS.failure(entry.id) },
                    requirements: entry.requirements.map((requirement) => ({
                        ...requirement,
                        ok: requirement.ok && started.has(requirement.id),
                    })),
                })),
                running: plugins()
                    .filter((entry) => started.has(entry.id))
                    .map((entry) => ({
                        id: entry.id,
                        name: entry.name,
                        ...started.get(entry.id),
                        problem: failures.get(entry.id) || null,
                    })),
            };
        }

        function publicOf(entry) {
            const { id, name, version, api, main, requires, permissions, urlSchemes } = entry;
            return { id, name, version, api, main, requires, permissions, urlSchemes };
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
            const manifest = installable(from);
            return {
                ...publicOf({ ...manifest, requires: manifest.requires }),
                from,
                replaces: entries.some((entry) => entry.id === manifest.id && entry.installed),
            };
        }

        // Any folder, since a plugin may already run code in this process: restricting where it comes from guards nothing.
        function install(from) {
            const manifest = installable(from);
            INSTALL.install(from);
            installs.set(manifest.id, (installs.get(manifest.id) || 0) + 1);
            MAIN_PROCESS.restartFor(manifest.id);
            refresh();
            return { ...publicOf(manifest), restart: MAIN_PROCESS.restartPending().some(({ id }) => id === manifest.id) };
        }

        function installable(from) {
            const { manifest, problem } = FOLDER.loadable(from);
            if (problem) throw new Error(problem);
            const source = entries.find((entry) => entry.id === manifest.id && !entry.installed);
            if (source)
                throw new Error(`${manifest.id} is read from ${source.folder}, which would hide the installed copy`);
            const copy = INSTALL.copyProblem(from);
            if (copy) throw new Error(copy);
            return manifest;
        }

        // Its view closes before its pages' storage is cleared, so the page cannot write it back.
        async function remove(id, data) {
            const entry = entries.find((candidate) => candidate.id === id);
            if (entry && !entry.installed)
                throw new Error(`${id} is read from ${entry.folder}, not installed, so it is removed there`);
            const removed = REMOVE.remove(id, { data });
            MAIN_PROCESS.unload(id);
            SETTING.forget(id);
            refresh();
            if (removed.data) await forget(id);
            return removed;
        }

        // A plugin whose data the command line removed: its pages' storage and sessions are cleared here.
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

        function refresh() {
            entries = catalog();
            notify();
        }

        function catalog() {
            return CATALOG.list().map((entry) => ({ ...entry, installs: installs.get(entry.id) || 0 }));
        }

        function notify() {
            for (const listener of listeners) listener(plugins());
        }

        // A plugin's place is the person's, kept in deckit's state. One never placed goes where the app ships it,
        // and one the app does not ship goes last, by id.
        function arranged(list) {
            const placed = order();
            const rank = (id) => {
                if (placed.includes(id)) return placed.indexOf(id);
                if (shipped.includes(id)) return placed.length + shipped.indexOf(id);
                return placed.length + shipped.length;
            };
            return [...list].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
        }

        return { start, plugins, prepare, rerun, summaryOf, failed, ended, onChange, onStatus, order, arrange };
    }
);
