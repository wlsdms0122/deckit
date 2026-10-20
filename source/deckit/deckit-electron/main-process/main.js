import * as FILE from './file.js';
import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';
import * as IPC from '../../deckit-shell/deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../deck/mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createMainProcess({ STORAGE, WINDOW, LOG, IDENTITY, RUNNER, FOLDER }) {
    // MARK: - Property
    // What a module's dispose has, as a mod's stop() has, and what a module still starting as its run ends has to
    // finish starting.
    const END_LIMIT_MS = 2000;
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    // `${mod id}\0${path}` -> promise of { relative, methods, paths, dispose }: a module started once in a run, by
    // the first who asks, in the order they started.
    const modules = new Map();
    // mod id -> { folder, root, code }: its folder when its first module started, that folder's real path, and each
    // file its modules required from it, by its path, with its contents' hash: the code that runs.
    const loaded = new Map();
    const live = new Set(); // mod ids with a module that started
    const failures = new Map(); // mod id -> Map of module path -> why it did not start
    // What only a restart can finish: a module with no dispose stays in the process, and one whose dispose failed
    // may have left what it made.
    const pending = new Map(); // mod id -> 'updated' | 'removed' | 'reinstalled' | 'leftover'
    const endings = new Map(); // mod id -> promise of its modules' end, after its run ended
    const windows = new Map(); // mod id -> the keys of the windows its modules opened
    const removing = new Set(); // mod ids taken away whose run has not ended yet
    const listeners = new Set(); // told when what a mod's facts say may have changed

    // MARK: - Initializer
    // MARK: - Public
    // The app quits once the modules of the runs that ended have ended too, each in its limit.
    function start() {
        RUNNER.observe('willLaunch', ({ mod }) => prepare(mod));
        RUNNER.observe('didTerminate', ({ mod }) => end(mod));
        const { app } = require('electron');
        app.on('will-quit', (event) => {
            if (!endings.size) return;
            event.preventDefault();
            Promise.allSettled([...endings.values()]).then(() => app.quit());
        });
        PROTOCOL.start.handle(({ path: given }, sender) =>
            load(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), given)
        );
        PROTOCOL.call.handle(({ path: given, method, args }, sender) =>
            call(IDENTITY.modFrom(sender, MAIN_PROCESS_PERMISSION.MAIN_PROCESS), given, method, args)
        );
        PROTOCOL.restartPending.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return restartPending();
        });
    }

    // A mod taken away: what its modules started keeps going until the process ends, unless they end with its run,
    // which is told once that run has ended.
    function unload(modId) {
        failures.delete(modId);
        const run = RUNNER.runOf(modId);
        if (keysOf(modId).length && run && run.state !== 'notRunning') removing.add(modId);
        else whenEnded(modId).then(() => loaded.has(modId) && setPending(modId, 'removed'));
    }

    // `listener()` is told when what `started`, `failure` or `restartPending` answer may have changed. Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
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

    // What was removed this run and stayed, installed again, is still a restart away: it is reinstalled.
    function reinstalled(modId) {
        if (pending.get(modId) === 'removed') setPending(modId, 'reinstalled');
    }

    // MARK: - Private
    // Before a mod runs again: modules it started from code that has changed since, and that stayed, keep running
    // the old code until a restart. Its new run asks for its modules again, so what failed before is asked again too.
    // Code changed back to what runs is no update.
    function prepare(mod) {
        failures.delete(mod.id);
        whenEnded(mod.id).then(() => {
            const before = loaded.get(mod.id);
            if (!before) return;
            const changed = before.folder !== mod.folder || !sameCode(before);
            if (changed) setPending(mod.id, pending.get(mod.id) === 'removed' ? 'reinstalled' : 'updated');
            else if (pending.get(mod.id) === 'updated') setPending(mod.id, null);
        });
    }

    // A run's modules end with it, each by its dispose, the last started first, and the next run requires them anew.
    // Only when every one of them has a dispose: one with none stays while the app runs, and with it the files
    // they share in the cache. One still starting past the limit is let go, and may leave what it makes. Its windows
    // close first, while the module that opened them is there to hear it. A failed dispose leaves the mod pending
    // until the app restarts.
    function end(mod) {
        const keys = keysOf(mod.id);
        if (!keys.length) return;
        const ending = (async () => {
            // Each module as it is by the limit: made, failed, or still starting (null).
            const results = await Promise.all(
                keys.map((key) =>
                    withinLimit(
                        modules.get(key).then(
                            (made) => ({ made }),
                            () => ({ made: null })
                        )
                    )
                )
            );
            const made = results.filter((result) => result?.made).map((result) => result.made);
            const starting = results.some((result) => !result);
            if (made.some(({ dispose }) => !dispose)) return starting && setPending(mod.id, 'leftover');
            for (const key of windows.get(mod.id) || []) WINDOW.close(key);
            windows.delete(mod.id);
            let clean = true;
            for (const { relative, dispose } of made.reverse())
                clean = (await disposed(mod, relative, dispose)) && clean;
            // One still starting is let go: the next run starts its own rather than wait on one that may never be
            // done.
            for (const key of keys) modules.delete(key);
            if (starting) clean = false;
            const root = loaded.get(mod.id)?.root;
            if (root) forget(root, Object.keys(require.cache));
            loaded.delete(mod.id);
            live.delete(mod.id);
            tell();
            if (!clean) setPending(mod.id, 'leftover');
            else if (pending.get(mod.id) !== 'leftover') setPending(mod.id, null);
        })().finally(() => {
            if (!removing.delete(mod.id)) return;
            if (loaded.has(mod.id) && pending.get(mod.id) !== 'leftover') setPending(mod.id, 'removed');
        });
        endings.set(mod.id, ending);
        ending.finally(() => endings.get(mod.id) === ending && endings.delete(mod.id));
    }

    // What `promise` resolves to, or null once the end's limit has passed.
    function withinLimit(promise) {
        let timer = null;
        const late = new Promise((resolve) => (timer = setTimeout(() => resolve(null), END_LIMIT_MS)));
        return Promise.race([promise, late]).finally(() => clearTimeout(timer));
    }

    // Whether the module ended what it made, in the limit.
    async function disposed(mod, relative, dispose) {
        try {
            const ended = await withinLimit(Promise.resolve(dispose()).then(() => true));
            if (!ended) throw new Error(`did not end in ${END_LIMIT_MS} ms`);
            return true;
        } catch (error) {
            LOG.error(`${mod.id} ${relative}: dispose failed`, error);
            return false;
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
        if (!loaded.has(mod.id))
            loaded.set(mod.id, { folder: mod.folder, root: fs.realpathSync(mod.folder) + path.sep, code: new Map() });
        const { root } = loaded.get(mod.id);
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
            noteCode(mod.id);
            tell();
            return { relative, methods, paths, dispose };
        } catch (error) {
            LOG.error(`${mod.id} ${relative} failed to start`, error);
            const why = String(error.message || error);
            if (!failures.has(mod.id)) failures.set(mod.id, new Map());
            failures.get(mod.id).set(relative, why.startsWith(relative) ? why : `${relative}: ${why}`);
            // Nothing of a mod none of whose modules started is running: all it required goes, and a fixed copy is
            // no update. Otherwise what this one required goes, and what the others share stays.
            if (live.has(mod.id)) forget(root, own);
            else {
                forget(root, Object.keys(require.cache));
                loaded.delete(mod.id);
            }
            tell();
            throw error;
        }
    }

    async function call(mod, given, method, args) {
        const key = `${mod.id}\0${path.posix.normalize(String(given))}`;
        if (!modules.has(key)) throw new Error(`${given} is not started; deck.mainProcess() starts it`);
        const { methods } = await modules.get(key);
        const found = methods.get(JSON.stringify(method));
        if (!found) throw new Error(`${given} has no method ${method.join('.')}`);
        let answer;
        try {
            answer = await found(...args);
        } finally {
            noteCode(mod.id);
        }
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

    // The files of the mod's folder its modules have required so far, by what they held then: a module may require
    // one when a method first needs it.
    function noteCode(modId) {
        const entry = loaded.get(modId);
        if (!entry) return;
        for (const key of Object.keys(require.cache))
            if (key.startsWith(entry.root) && !entry.code.has(key)) entry.code.set(key, hashOf(key));
    }

    function keysOf(modId) {
        return [...modules.keys()].filter((key) => key.startsWith(modId + '\0'));
    }

    function setPending(modId, why) {
        if ((pending.get(modId) || null) === why) return;
        if (why) pending.set(modId, why);
        else pending.delete(modId);
        tell();
    }

    function tell() {
        for (const listener of [...listeners]) listener();
    }

    // A module that threw, or ended, stays cached, so a fixed version installed later would load the old one. What
    // of `keys` the cache holds under `root` goes, and with it the hold the module that required it keeps on it.
    function forget(root, keys) {
        for (const key of keys) {
            const cached = require.cache[key];
            if (!key.startsWith(root) || !cached) continue;
            if (cached.parent) cached.parent.children = cached.parent.children.filter((child) => child !== cached);
            delete require.cache[key];
        }
    }

    // Whether the files the mod's modules required hold what they held when they were required: an install copies a
    // folder anew, so a time says nothing of whether its code changed.
    function sameCode({ code }) {
        for (const [file, hash] of code) if (hashOf(file) !== hash) return false;
        return true;
    }

    function hashOf(file) {
        try {
            return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        } catch {
            return '';
        }
    }

    return { start, unload, onChange, whenEnded, started, failure, restartPending, reinstalled };
}
