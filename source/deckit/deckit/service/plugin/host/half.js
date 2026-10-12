DeckitModule.define(
    'deckit/service/plugin/host/half',
    {
        uses: [
            'deckit/module/file',
            'deckit/service/storage',
            'deckit/service/window',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host/protocol',
        ],
        provides: ['start', 'load', 'unload', 'running', 'failure', 'restartPending', 'restartFor'],
        runs: 'main',
    },
    (FILE, STORAGE, WINDOW, LOG, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        const halves = new Map(); // plugin id -> { ops, hash, folder }
        const failures = new Map(); // plugin id -> why its main half did not load
        // What only a restart can finish: a main half once required stays in the process.
        const pending = new Map(); // plugin id -> 'updated' | 'removed' | 'reinstalled'

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.callMain.handle(({ op, args }, sender) => call(IDENTITY.pluginFrom(sender), op, args));
        }

        // Loaded once and kept: a main half holds state (a token, a watcher), and loading it twice makes two of
        // everything. An id whose code changed underneath it waits for a restart.
        function load(entry) {
            const running = halves.get(entry.id);
            if (running) {
                if (running.folder !== entry.folder || hashOf(entry.folder) !== running.hash)
                    pending.set(entry.id, 'updated');
                return;
            }
            const ops = new Map();
            const handle = (name, operation) => ops.set(String(name), operation);
            const send = (name, ...args) => {
                const view = IDENTITY.pageOf(entry.id);
                if (view) PROTOCOL.mainEvent.send(view, { name: String(name), args });
            };
            // The id is part of the key, so two plugins asking for "log" get two windows and neither closes the other's.
            const window = {
                open: (options = {}) => WINDOW.open({ ...options, key: `${entry.id}:${options.key || 'main'}` }),
                get: (key) => WINDOW.get(`${entry.id}:${key || 'main'}`),
                close: (key) => WINDOW.close(`${entry.id}:${key || 'main'}`),
            };
            try {
                require(path.join(entry.folder, 'main.js'))({
                    id: entry.id,
                    folder: STORAGE.folderOf(entry.id),
                    handle,
                    send,
                    window,
                    files: FILE,
                });
                halves.set(entry.id, { ops, hash: hashOf(entry.folder), folder: entry.folder });
                failures.delete(entry.id);
                LOG.info(`${entry.id} main half: ${[...ops.keys()].join(', ') || 'no ops'}`);
            } catch (error) {
                // The view still loads, and Settings says what is missing.
                LOG.error(`${entry.id} main half failed to load`, error);
                failures.set(entry.id, String(error.message || error));
                forgetModule(entry.folder);
            }
        }

        // A plugin taken away: whatever its main half started keeps going until the process ends.
        function unload(pluginId) {
            if (halves.has(pluginId)) pending.set(pluginId, 'removed');
        }

        function running(pluginId) {
            return halves.has(pluginId);
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
        async function call(plugin, op, args) {
            const half = halves.get(plugin.id);
            if (!half) throw new Error(`${plugin.id} has no main half running`);
            const operation = half.ops.get(op);
            if (!operation) throw new Error(`${plugin.id} has no op ${op}`);
            return operation(...args);
        }

        function hashOf(folder) {
            const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(folder, 'main.js')));
            const parts = path.join(folder, 'main');
            for (const file of scriptsIn(parts))
                hash.update('\0' + file + '\0').update(fs.readFileSync(path.join(parts, file)));
            return hash.digest('hex');
        }

        function scriptsIn(folder) {
            if (!fs.existsSync(folder)) return [];
            return fs
                .readdirSync(folder, { recursive: true })
                .filter((file) => file.endsWith('.js'))
                .sort();
        }

        // A module that threw stays cached, so a fixed version installed later would load the broken one. Keyed by
        // the real path, which differs when the plugins folder sits behind a link.
        function forgetModule(folder) {
            const real = fs.realpathSync(folder);
            for (const key of Object.keys(require.cache)) {
                if (key.startsWith(folder + path.sep) || key.startsWith(real + path.sep)) delete require.cache[key];
            }
        }

        return { start, load, unload, running, failure, restartPending, restartFor };
    }
);
