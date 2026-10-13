DeckitModule.define(
    'deckit/service/plugin/deck/main-process',
    {
        uses: [
            'deckit/module/file',
            'deckit/service/storage',
            'deckit/service/window',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/package/folder',
            'deckit/service/plugin/package/model/permission',
            'deckit/service/plugin/deck/protocol',
        ],
        provides: ['start', 'prepare', 'unload', 'running', 'failure', 'restartPending', 'restartFor'],
        runs: 'main',
    },
    (FILE, STORAGE, WINDOW, LOG, IDENTITY, FOLDER, PERMISSION, PROTOCOL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        // `${plugin id}\0${path}` -> promise of { methods, paths }: a module started once, by the first who asks.
        const modules = new Map();
        // plugin id -> { folder, stamp }: its folder as it was when its first module started. A module may require any
        // file of it, then or later, so a change anywhere in it is new code for what runs.
        const loaded = new Map();
        const live = new Set(); // plugin ids with a module that started
        const failures = new Map(); // plugin id -> Map of module path -> why it did not start
        // What only a restart can finish: a module once required stays in the process.
        const pending = new Map(); // plugin id -> 'updated' | 'removed' | 'reinstalled'

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.startMainProcess.handle(({ path: given }, sender) =>
                load(IDENTITY.pluginFrom(sender, PERMISSION.MAIN_PROCESS), given)
            );
            PROTOCOL.callMainProcess.handle(({ path: given, method, args }, sender) =>
                call(IDENTITY.pluginFrom(sender, PERMISSION.MAIN_PROCESS), given, method, args)
            );
        }

        // Before a plugin runs again: modules it started from code that has changed since keep running the old code
        // until a restart. Its new run asks for its modules again, so what failed before is asked again too.
        function prepare(entry) {
            const before = loaded.get(entry.id);
            if (before && (before.folder !== entry.folder || stampOf(entry.folder, entry.main) !== before.stamp))
                pending.set(entry.id, 'updated');
            failures.delete(entry.id);
        }

        // A plugin taken away: whatever its modules started keeps going until the process ends.
        function unload(pluginId) {
            if (loaded.has(pluginId)) pending.set(pluginId, 'removed');
            failures.delete(pluginId);
        }

        function running(pluginId) {
            return live.has(pluginId);
        }

        function failure(pluginId) {
            const failed = [...(failures.get(pluginId)?.values() || [])];
            return failed.length ? failed.join('; ') : null;
        }

        function restartPending() {
            return [...pending].map(([id, why]) => ({ id, why }));
        }

        // Installing again what was removed this run is still a restart away.
        function restartFor(pluginId) {
            if (pending.get(pluginId) === 'removed') pending.set(pluginId, 'reinstalled');
        }

        // MARK: - Private
        // One instance for each plugin and file while the app runs: a module holds state (a token, a watcher), and
        // starting it twice makes two of everything. Answers { path, methods }, the paths of its functions.
        async function load(plugin, given) {
            const { file, relative } = locate(plugin.folder, given);
            const key = `${plugin.id}\0${relative}`;
            if (!modules.has(key)) {
                const made = make(plugin, file, relative);
                modules.set(key, made);
                made.catch(() => modules.get(key) === made && modules.delete(key));
            }
            const { paths } = await modules.get(key);
            return { path: relative, methods: paths };
        }

        // Its files are what require() adds to the cache, and require() runs to its end before anything else does.
        async function make(plugin, file, relative) {
            if (!loaded.has(plugin.id))
                loaded.set(plugin.id, { folder: plugin.folder, stamp: stampOf(plugin.folder, plugin.main) });
            const before = new Set(Object.keys(require.cache));
            let own = null;
            const added = () => Object.keys(require.cache).filter((key) => !before.has(key));
            try {
                let factory;
                try {
                    factory = require(file);
                } finally {
                    own = added();
                }
                if (typeof factory !== 'function')
                    throw new Error(
                        `${relative} exports no function; a main process module is (deck) => ({ methods })`
                    );
                const made = await factory(deckOf(plugin, relative));
                const methods = methodsOf(made, relative);
                failures.get(plugin.id)?.delete(relative);
                live.add(plugin.id);
                const paths = [...methods.keys()].map((key) => JSON.parse(key));
                LOG.info(`${plugin.id} ${relative}: ${paths.map((path) => path.join('.')).join(', ') || 'no methods'}`);
                return { methods, paths };
            } catch (error) {
                LOG.error(`${plugin.id} ${relative} failed to start`, error);
                const why = String(error.message || error);
                if (!failures.has(plugin.id)) failures.set(plugin.id, new Map());
                failures.get(plugin.id).set(relative, why.startsWith(relative) ? why : `${relative}: ${why}`);
                forget(plugin, own);
                // Nothing of a plugin whose first module did not start is running: a fixed copy is no update.
                if (!live.has(plugin.id)) loaded.delete(plugin.id);
                throw error;
            }
        }

        async function call(plugin, given, method, args) {
            const key = `${plugin.id}\0${path.posix.normalize(String(given))}`;
            if (!modules.has(key)) throw new Error(`${given} is not started; deck.mainProcess() starts it`);
            const { methods } = await modules.get(key);
            const found = methods.get(JSON.stringify(method));
            if (!found) throw new Error(`${given} has no method ${method.join('.')}`);
            const answer = await found(...args);
            try {
                structuredClone(answer);
            } catch (error) {
                throw new Error(`${given} ${method.join('.')} answered what cannot be copied: ${error.message}`);
            }
            return answer;
        }

        // What a module is handed. The id is part of a window's key, so two plugins asking for "log" get two windows
        // and neither closes the other's.
        function deckOf(plugin, relative) {
            return Object.freeze({
                id: plugin.id,
                folder: STORAGE.folderOf(plugin.id),
                emit(name, ...args) {
                    const page = IDENTITY.pageOf(plugin.id);
                    if (page) PROTOCOL.mainProcessEvent.send(page, { path: relative, name: String(name), args });
                },
                window: Object.freeze({
                    open: (options = {}) => WINDOW.open({ ...options, key: `${plugin.id}:${options.key || 'main'}` }),
                    get: (key) => WINDOW.get(`${plugin.id}:${key || 'main'}`),
                    close: (key) => WINDOW.close(`${plugin.id}:${key || 'main'}`),
                    ofPage: () => {
                        const page = IDENTITY.pageOf(plugin.id);
                        return page ? WINDOW.windowShowing(page) : null;
                    },
                }),
                files: FILE,
            });
        }

        // Its functions by path, nested objects walked, as a plugin's exports are. `on` is the proxy's own: how the
        // plugin hears what the module emits.
        function methodsOf(made, relative) {
            if (!made || typeof made !== 'object')
                throw new Error(
                    `${relative} gave no object of methods; a main process module is (deck) => ({ methods })`
                );
            if (Object.hasOwn(made, 'on'))
                throw new Error(`${relative} has a method "on", which is how its events are heard`);
            const methods = new Map();
            const walking = new Set(); // an object that holds itself is walked once
            const walk = (value, trail) => {
                if (typeof value === 'function') return methods.set(JSON.stringify(trail), value);
                if (!value || typeof value !== 'object' || walking.has(value)) return;
                walking.add(value);
                for (const [key, inner] of Object.entries(value)) walk(inner, [...trail, key]);
                walking.delete(value);
            };
            walk(made, []);
            return methods;
        }

        function locate(folder, given) {
            const found = FOLDER.fileIn(folder, String(given));
            if (!found) throw new Error(`${given} is no file in the plugin's folder`);
            return found;
        }

        // A module that threw stays cached, so a fixed version installed later would load the broken one. What its
        // require() put in the cache from the plugin's folder goes.
        function forget(plugin, own) {
            const root = fs.realpathSync(plugin.folder) + path.sep;
            for (const key of own) if (key.startsWith(root)) delete require.cache[key];
        }

        // Every file of the folder by its path, size and time, but for the entry, which runs in the sandbox.
        function stampOf(folder, main) {
            const hash = crypto.createHash('sha256');
            const entry = FOLDER.entryOf(folder, { main });
            let root = folder;
            const walk = (at) => {
                for (const item of fs
                    .readdirSync(at, { withFileTypes: true })
                    .sort((a, b) => (a.name < b.name ? -1 : 1))) {
                    const full = path.join(at, item.name);
                    if (item.isDirectory()) walk(full);
                    else if (item.isFile() && full !== entry) {
                        const { size, mtimeMs } = fs.statSync(full);
                        hash.update(`${path.relative(root, full)}\0${size}\0${mtimeMs}\0`);
                    }
                }
            };
            try {
                root = fs.realpathSync(folder);
                walk(root);
            } catch {
                hash.update('unreadable');
            }
            return hash.digest('hex');
        }

        return { start, prepare, unload, running, failure, restartPending, restartFor };
    }
);
