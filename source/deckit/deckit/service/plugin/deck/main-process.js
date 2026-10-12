DeckitModule.define(
    'deckit/service/plugin/deck/main-process',
    {
        uses: [
            'deckit/module/file',
            'deckit/service/storage',
            'deckit/service/window',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/package/model/permission',
            'deckit/service/plugin/deck/protocol',
        ],
        provides: ['start', 'prepare', 'unload', 'running', 'failure', 'restartPending', 'restartFor'],
        runs: 'main',
    },
    (FILE, STORAGE, WINDOW, LOG, IDENTITY, PERMISSION, PROTOCOL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        // `${plugin id}\0${path}` -> promise of { methods, paths }: a module started once, by the first who asks.
        const modules = new Map();
        // plugin id -> { folder, files, hash }: the files its modules required, as they were when they were.
        const loaded = new Map();
        const failures = new Map(); // plugin id -> why its last module did not start
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
        // until a restart.
        function prepare(entry) {
            const before = loaded.get(entry.id);
            if (before && (before.folder !== entry.folder || hashOf(entry.folder, before.files) !== before.hash))
                pending.set(entry.id, 'updated');
        }

        // A plugin taken away: whatever its modules started keeps going until the process ends.
        function unload(pluginId) {
            if (loaded.has(pluginId)) pending.set(pluginId, 'removed');
        }

        function running(pluginId) {
            return loaded.has(pluginId);
        }

        function failure(pluginId) {
            return failures.get(pluginId) || null;
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

        async function make(plugin, file, relative) {
            const before = new Set(Object.keys(require.cache));
            try {
                const factory = require(file);
                if (typeof factory !== 'function')
                    throw new Error(`${relative} exports no function; a main process module is (deck) => ({ methods })`);
                const made = await factory(deckOf(plugin, relative));
                const methods = methodsOf(made, relative);
                remember(plugin);
                failures.delete(plugin.id);
                const paths = [...methods.keys()].map((key) => JSON.parse(key));
                LOG.info(`${plugin.id} ${relative}: ${paths.map((path) => path.join('.')).join(', ') || 'no methods'}`);
                return { methods, paths };
            } catch (error) {
                // A module that threw stays cached, so a fixed version installed later would load the broken one.
                LOG.error(`${plugin.id} ${relative} failed to start`, error);
                failures.set(plugin.id, `${relative}: ${error.message || error}`);
                for (const key of Object.keys(require.cache)) if (!before.has(key)) delete require.cache[key];
                throw error;
            }
        }

        async function call(plugin, given, method, args) {
            const key = `${plugin.id}\0${path.posix.normalize(String(given))}`;
            if (!modules.has(key)) throw new Error(`${given} is not started; deck.mainProcess() starts it`);
            const { methods } = await modules.get(key);
            const found = methods.get(JSON.stringify(method));
            if (!found) throw new Error(`${given} has no method ${method.join('.')}`);
            return found(...args);
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
                throw new Error(`${relative} gave no object of methods; a main process module is (deck) => ({ methods })`);
            if (Object.hasOwn(made, 'on')) throw new Error(`${relative} has a method "on", which is how its events are heard`);
            const methods = new Map();
            const walk = (value, trail) => {
                if (typeof value === 'function') return methods.set(JSON.stringify(trail), value);
                if (value && typeof value === 'object')
                    for (const [key, inner] of Object.entries(value)) walk(inner, [...trail, key]);
            };
            walk(made, []);
            return methods;
        }

        // A file of the plugin's folder, where it really is, by its path from the folder.
        function locate(folder, given) {
            const root = fs.realpathSync(folder);
            let file;
            try {
                file = fs.realpathSync(path.resolve(root, String(given)));
            } catch {
                throw new Error(`no file ${given} in the plugin's folder`);
            }
            const inside = path.relative(root, file);
            if (!inside || inside.startsWith('..') || path.isAbsolute(inside))
                throw new Error(`${given} is not a file in the plugin's folder`);
            return { file, relative: inside.split(path.sep).join('/') };
        }

        // Every file of the folder the process has required for this plugin.
        function remember(plugin) {
            const root = fs.realpathSync(plugin.folder) + path.sep;
            const files = Object.keys(require.cache)
                .filter((key) => key.startsWith(root))
                .map((key) => key.slice(root.length))
                .sort();
            loaded.set(plugin.id, { folder: plugin.folder, files, hash: hashOf(plugin.folder, files) });
        }

        function hashOf(folder, files) {
            const hash = crypto.createHash('sha256');
            for (const file of files) {
                const full = path.join(folder, file);
                hash.update('\0' + file + '\0').update(fs.existsSync(full) ? fs.readFileSync(full) : '');
            }
            return hash.digest('hex');
        }

        return { start, prepare, unload, running, failure, restartPending, restartFor };
    }
);
