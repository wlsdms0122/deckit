import * as FILE from './file.js';
import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as PROTOCOL from './protocol.js';
import * as DECK from '../../deck/main.js';

export function createMainProcess({ STORAGE, WINDOW, LOG, IDENTITY, RUNNER, FOLDER }) {
    // MARK: - Property
    const DISPOSE_LIMIT_MS = 2000; // what a module's dispose has, as a mod's stop() has
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    // `${mod id}\0${path}` -> promise of { relative, methods, paths, dispose }: a module started once in a run, by
    // the first who asks, in the order they started.
    const modules = new Map();
    // mod id -> { folder, stamp }: its folder as it was when its first module started. A module may require any
    // file of it, then or later, so a change anywhere in it is new code for what runs.
    const loaded = new Map();
    const live = new Set(); // mod ids with a module that started
    const failures = new Map(); // mod id -> Map of module path -> why it did not start
    // What only a restart can finish: a module with no dispose stays in the process, and one whose dispose failed
    // may have left what it made.
    const pending = new Map(); // mod id -> 'updated' | 'removed' | 'reinstalled' | 'leftover'
    const endings = new Map(); // mod id -> promise of its modules' end, after its run ended
    const windows = new Map(); // mod id -> the keys of the windows its modules opened

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => prepare(mod));
        RUNNER.observe('didTerminate', ({ mod }) => end(mod));
        PROTOCOL.start.handle(({ path: given }, sender) =>
            load(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), given)
        );
        PROTOCOL.call.handle(({ path: given, method, args }, sender) =>
            call(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), given, method, args)
        );
        PROTOCOL.restartPending.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, DECK.MODS);
            return restartPending();
        });
    }

    // A mod taken away: what its modules started keeps going until the process ends, unless they ended with its run.
    function unload(modId) {
        failures.delete(modId);
        return whenEnded(modId).then(() => loaded.has(modId) && pending.set(modId, 'removed'));
    }

    // Once the modules of the mod's run that ended have ended too, or stayed.
    function whenEnded(modId) {
        return endings.get(modId) || Promise.resolve();
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
    // Before a mod runs again: modules it started from code that has changed since, and that stayed, keep running
    // the old code until a restart. Its new run asks for its modules again, so what failed before is asked again too.
    function prepare(mod) {
        failures.delete(mod.id);
        whenEnded(mod.id).then(() => {
            const before = loaded.get(mod.id);
            if (!before || (before.folder === mod.folder && stampOf(mod.folder, mod.main) === before.stamp)) return;
            pending.set(mod.id, pending.get(mod.id) === 'removed' ? 'reinstalled' : 'updated');
        });
    }

    // A run's modules end with it, each by its dispose, the last started first, and the next run requires them anew.
    // Only when every one of them has a dispose: one with none stays while the app runs, and with it the files
    // they share in the cache.
    function end(mod) {
        const keys = [...modules.keys()].filter((key) => key.startsWith(mod.id + '\0'));
        if (!keys.length) return;
        const ending = (async () => {
            const settled = await Promise.allSettled(keys.map((key) => modules.get(key)));
            const made = settled.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
            if (made.some(({ dispose }) => !dispose)) return;
            let clean = true;
            for (const { relative, dispose } of made.reverse())
                clean = (await disposed(mod, relative, dispose)) && clean;
            for (const key of keys) modules.delete(key);
            forget(mod, Object.keys(require.cache));
            for (const key of windows.get(mod.id) || []) WINDOW.close(key);
            windows.delete(mod.id);
            loaded.delete(mod.id);
            live.delete(mod.id);
            if (clean) pending.delete(mod.id);
            else pending.set(mod.id, 'leftover');
        })();
        endings.set(mod.id, ending);
        ending.finally(() => endings.get(mod.id) === ending && endings.delete(mod.id));
    }

    // Whether the module ended what it made, in the time a mod's stop() has.
    async function disposed(mod, relative, dispose) {
        let timer = null;
        try {
            await Promise.race([
                dispose(),
                new Promise((_resolve, reject) => {
                    timer = setTimeout(
                        () => reject(new Error(`did not end in ${DISPOSE_LIMIT_MS} ms`)),
                        DISPOSE_LIMIT_MS
                    );
                }),
            ]);
            return true;
        } catch (error) {
            LOG.error(`${mod.id} ${relative}: dispose failed`, error);
            return false;
        } finally {
            clearTimeout(timer);
        }
    }

    // One instance for each mod and file in a run: a module holds state (a token, a watcher), and starting it twice
    // makes two of everything. Answers { path, methods }, the paths of its functions.
    async function load(mod, given) {
        await whenEnded(mod.id);
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
                throw new Error(`${relative} exports no function; a main process module is (deck) => ({ methods })`);
            const made = await factory(deckOf(mod, relative));
            const methods = methodsOf(made, relative);
            failures.get(mod.id)?.delete(relative);
            live.add(mod.id);
            const paths = [...methods.keys()].map((key) => JSON.parse(key));
            LOG.info(`${mod.id} ${relative}: ${paths.map((path) => path.join('.')).join(', ') || 'no methods'}`);
            const dispose = typeof made.dispose === 'function' ? () => made.dispose() : null;
            return { relative, methods, paths, dispose };
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
                open: (options = {}) => {
                    const key = `${mod.id}:${options.key || 'main'}`;
                    if (!windows.has(mod.id)) windows.set(mod.id, new Set());
                    windows.get(mod.id).add(key);
                    return WINDOW.open({ ...options, key });
                },
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
    // mod hears what the module emits. `dispose` is deckit's to call, as the module ends.
    function methodsOf(made, relative) {
        if (!made || typeof made !== 'object')
            throw new Error(`${relative} gave no object of methods; a main process module is (deck) => ({ methods })`);
        if (Object.hasOwn(made, 'on'))
            throw new Error(`${relative} has a method "on", which is how its events are heard`);
        if (Object.hasOwn(made, 'dispose') && typeof made.dispose !== 'function')
            throw new Error(`${relative} has a "dispose" that is not a function, which is how it ends`);
        const methods = new Map();
        const walking = new Set(); // an object that holds itself is walked once
        const walk = (value, trail) => {
            if (typeof value === 'function') return methods.set(JSON.stringify(trail), value);
            if (!value || typeof value !== 'object' || walking.has(value)) return;
            walking.add(value);
            for (const [key, inner] of Object.entries(value)) walk(inner, [...trail, key]);
            walking.delete(value);
        };
        const { dispose: _dispose, ...rest } = made;
        walk(rest, []);
        return methods;
    }

    function locate(folder, given) {
        const found = FOLDER.fileIn(folder, String(given));
        if (!found) throw new Error(`${given} is no file in the mod's folder`);
        return found;
    }

    // A module that threw, or ended, stays cached, so a fixed version installed later would load the old one. What
    // of `keys` the cache holds from the mod's folder goes.
    function forget(mod, own) {
        const root = fs.realpathSync(mod.folder) + path.sep;
        for (const key of own) if (key.startsWith(root)) delete require.cache[key];
    }

    // Every file of the folder by its path and contents, but for the entry, which runs in the sandbox: an install
    // copies a folder anew, so a time says nothing of whether its code changed.
    function stampOf(folder, main) {
        const hash = crypto.createHash('sha256');
        const entry = FOLDER.entryOf(folder, { main });
        let root = folder;
        const walk = (at) => {
            for (const item of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
                const full = path.join(at, item.name);
                if (item.isDirectory()) walk(full);
                else if (item.isFile() && full !== entry) {
                    hash.update(`${path.relative(root, full)}\0`);
                    hash.update(fs.readFileSync(full));
                    hash.update('\0');
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

    return { start, unload, whenEnded, started, failure, restartPending, restartFor };
}
