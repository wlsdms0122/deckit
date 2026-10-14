DeckitModule.define(
    'deckit/service/main-process/main',
    {
        uses: [
            'deckit/module/file',
            'deck/service/storage',
            'deckit/service/window',
            'deck/service/log/main',
            'deck/service/deck/identity',
            'deck/service/deck/runner',
            'deck/service/mod/folder',
            'deckit/service/main-process/model/permission',
            'deckit/service/main-process/protocol',
            'deck/service/mod/permission',
        ],
        provides: ['start', 'unload', 'started', 'failure', 'restartPending', 'restartFor'],
        runs: 'main',
    },
    (FILE, STORAGE, WINDOW, LOG, IDENTITY, RUNNER, FOLDER, PERMISSION, PROTOCOL, MOD_PERMISSION) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        // `${mod id}\0${path}` -> promise of { methods, paths }: a module started once, by the first who asks.
        const modules = new Map();
        // mod id -> { folder, stamp }: its folder as it was when its first module started. A module may require any
        // file of it, then or later, so a change anywhere in it is new code for what runs.
        const loaded = new Map();
        const live = new Set(); // mod ids with a module that started
        const failures = new Map(); // mod id -> Map of module path -> why it did not start
        // What only a restart can finish: a module once required stays in the process.
        const pending = new Map(); // mod id -> 'updated' | 'removed' | 'reinstalled'

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            RUNNER.observe('willLaunch', ({ mod }) => prepare(mod));
            PROTOCOL.start.handle(({ path: given }, sender) =>
                load(IDENTITY.modFrom(sender, PERMISSION.PERMISSION), given)
            );
            PROTOCOL.call.handle(({ path: given, method, args }, sender) =>
                call(IDENTITY.modFrom(sender, PERMISSION.PERMISSION), given, method, args)
            );
            PROTOCOL.restartPending.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
                return restartPending();
            });
        }

        // A mod taken away: whatever its modules started keeps going until the process ends.
        function unload(modId) {
            if (loaded.has(modId)) pending.set(modId, 'removed');
            failures.delete(modId);
        }

        function started(modId) {
            return live.has(modId);
        }

        function failure(modId) {
            const failed = [...(failures.get(modId)?.values() || [])];
            return failed.length ? failed.join('; ') : null;
        }

        function restartPending() {
            return [...pending].map(([id, why]) => ({ id, why }));
        }

        // Installing again what was removed this run is still a restart away.
        function restartFor(modId) {
            if (pending.get(modId) === 'removed') pending.set(modId, 'reinstalled');
        }

        // MARK: - Private
        // Before a mod runs again: modules it started from code that has changed since keep running the old code
        // until a restart. Its new run asks for its modules again, so what failed before is asked again too.
        function prepare(mod) {
            const before = loaded.get(mod.id);
            if (before && (before.folder !== mod.folder || stampOf(mod.folder, mod.main) !== before.stamp))
                pending.set(mod.id, 'updated');
            failures.delete(mod.id);
        }

        // One instance for each mod and file while the app runs: a module holds state (a token, a watcher), and
        // starting it twice makes two of everything. Answers { path, methods }, the paths of its functions.
        async function load(mod, given) {
            const { file, relative } = locate(mod.folder, given);
            const key = `${mod.id}\0${relative}`;
            if (!modules.has(key)) {
                const made = make(mod, file, relative);
                modules.set(key, made);
                made.catch(() => modules.get(key) === made && modules.delete(key));
            }
            const { paths } = await modules.get(key);
            return { path: relative, methods: paths };
        }

        // Its files are what require() adds to the cache, and require() runs to its end before anything else does.
        async function make(mod, file, relative) {
            if (!loaded.has(mod.id)) loaded.set(mod.id, { folder: mod.folder, stamp: stampOf(mod.folder, mod.main) });
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
                const made = await factory(deckOf(mod, relative));
                const methods = methodsOf(made, relative);
                failures.get(mod.id)?.delete(relative);
                live.add(mod.id);
                const paths = [...methods.keys()].map((key) => JSON.parse(key));
                LOG.info(`${mod.id} ${relative}: ${paths.map((path) => path.join('.')).join(', ') || 'no methods'}`);
                return { methods, paths };
            } catch (error) {
                LOG.error(`${mod.id} ${relative} failed to start`, error);
                const why = String(error.message || error);
                if (!failures.has(mod.id)) failures.set(mod.id, new Map());
                failures.get(mod.id).set(relative, why.startsWith(relative) ? why : `${relative}: ${why}`);
                forget(mod, own);
                // Nothing of a mod whose first module did not start is running: a fixed copy is no update.
                if (!live.has(mod.id)) loaded.delete(mod.id);
                throw error;
            }
        }

        async function call(mod, given, method, args) {
            const key = `${mod.id}\0${path.posix.normalize(String(given))}`;
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

        // What a module is handed. The id is part of a window's key, so two mods asking for "log" get two windows
        // and neither closes the other's.
        function deckOf(mod, relative) {
            return Object.freeze({
                id: mod.id,
                folder: STORAGE.folderOf(mod.id),
                emit(name, ...args) {
                    const page = IDENTITY.pageOf(mod.id);
                    if (page) PROTOCOL.event.send(page, { path: relative, name: String(name), args });
                },
                window: Object.freeze({
                    open: (options = {}) => WINDOW.open({ ...options, key: `${mod.id}:${options.key || 'main'}` }),
                    get: (key) => WINDOW.get(`${mod.id}:${key || 'main'}`),
                    close: (key) => WINDOW.close(`${mod.id}:${key || 'main'}`),
                    ofPage: () => {
                        const page = IDENTITY.pageOf(mod.id);
                        return page ? WINDOW.windowShowing(page) : null;
                    },
                }),
                files: FILE,
            });
        }

        // Its functions by path, nested objects walked, as a mod's exports are. `on` is the proxy's own: how the
        // mod hears what the module emits.
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
            if (!found) throw new Error(`${given} is no file in the mod's folder`);
            return found;
        }

        // A module that threw stays cached, so a fixed version installed later would load the broken one. What its
        // require() put in the cache from the mod's folder goes.
        function forget(mod, own) {
            const root = fs.realpathSync(mod.folder) + path.sep;
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

        return { start, unload, started, failure, restartPending, restartFor };
    }
);
