DeckitModule.define(
    'deckit/service/storage',
    {
        uses: ['deckit/service/home', 'deckit/module/store'],
        provides: ['folderOf', 'records', 'settings', 'state', 'count', 'forget'],
        runs: 'node',
    },
    (HOME, STORE) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
        const COUNT_LIMIT = 1000;

        // A plugin's records: JSON by key, kept by deckit apart from the folder its main half owns.
        const records = {
            read: (pluginId, key) => STORE.read(recordFile(pluginId, key)),
            write: (pluginId, key, value) => STORE.write(recordFile(pluginId, key), value),
            remove: (pluginId, key) => STORE.remove(recordFile(pluginId, key)),
            keys: (pluginId) => keysOf(path.join(HOME.records, pluginId)),
        };

        // A plugin's settings are deckit's to keep, so they live outside the plugin's folder.
        const settings = {
            read: (pluginId) => STORE.read(path.join(HOME.settings, pluginId + '.json'), {}),
            write: (pluginId, values) => STORE.write(path.join(HOME.settings, pluginId + '.json'), values),
        };

        // deckit's own state: the key map, the Open With order, the plugin order, window places.
        const state = {
            read: (key, fallback) => STORE.read(path.join(HOME.state, key + '.json'), fallback),
            write: (key, value) => STORE.write(path.join(HOME.state, key + '.json'), value),
        };

        // MARK: - Initializer
        // MARK: - Public
        // Plugin ids are held to their rule before a plugin loads, so an id here is a folder name.
        function folderOf(pluginId) {
            return path.join(HOME.data, pluginId);
        }

        // Every file counts, its main half's included: forgetting takes them all.
        async function count(pluginId) {
            const seen = { count: 0, capped: false, hidden: false };
            await walk(folderOf(pluginId), 0, seen);
            await walk(path.join(HOME.records, pluginId), 0, seen);
            return seen;
        }

        // What deckit kept for a plugin. Its pages' storage and its web sessions are their sessions' to clear.
        function forget(pluginId) {
            fs.rmSync(folderOf(pluginId), { recursive: true, force: true });
            fs.rmSync(path.join(HOME.records, pluginId), { recursive: true, force: true });
            fs.rmSync(path.join(HOME.settings, pluginId + '.json'), { force: true });
        }

        // MARK: - Private
        function recordFile(pluginId, key) {
            if (!KEY.test(String(key)) || String(key).includes('..')) {
                throw Object.assign(new Error('not a record key: ' + key), { kind: 'KEY' });
            }
            return path.join(HOME.records, pluginId, key + '.json');
        }

        function keysOf(folder) {
            if (!fs.existsSync(folder)) return [];
            return fs
                .readdirSync(folder)
                .filter((name) => name.endsWith('.json') && KEY.test(name.slice(0, -5)))
                .map((name) => name.slice(0, -5));
        }

        async function walk(folder, depth, seen) {
            const entries = await fs.promises.readdir(folder, { withFileTypes: true }).catch(() => []);
            for (const entry of entries) {
                if (seen.capped) return;
                if (entry.name.startsWith('.')) seen.hidden = true;
                else if (entry.isDirectory() && depth < 8) await walk(path.join(folder, entry.name), depth + 1, seen);
                else if (entry.isFile() && seen.count >= COUNT_LIMIT) seen.capped = true;
                else if (entry.isFile()) seen.count++;
            }
        }

        return { folderOf, records, settings, state, count, forget };
    }
);
