DeckitModule.define(
    'deckit/service/storage',
    {
        uses: ['deckit/service/home', 'deckit/module/store'],
        provides: ['folderOf', 'records', 'settings', 'state', 'hostState', 'count', 'forget'],
        runs: 'node',
    },
    (HOME, STORE) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
        const COUNT_LIMIT = 1000;

        // A mod's records: JSON by key, kept by deckit apart from the folder its main process modules own.
        const records = {
            read: (modId, key) => STORE.read(recordFile(modId, key)),
            write: (modId, key, value) => STORE.write(recordFile(modId, key), value),
            remove: (modId, key) => STORE.remove(recordFile(modId, key)),
            keys: (modId) => keysOf(path.join(HOME.records, modId)),
        };

        // A mod's settings are deckit's to keep, so they live outside the mod's folder.
        const settings = {
            read: (modId) => STORE.read(path.join(HOME.settings, modId + '.json'), {}),
            write: (modId, values) => STORE.write(path.join(HOME.settings, modId + '.json'), values),
        };

        // What the person arranged: the key map, each scheme's handlers, the mod order.
        const state = {
            read: (key, fallback) => STORE.read(path.join(HOME.state, key + '.json'), fallback),
            write: (key, value) => STORE.write(path.join(HOME.state, key + '.json'), value),
        };

        // What the host app and its shell keep of the person's, in a folder of their own: deckit's state is not theirs
        // to write.
        const hostState = {
            read: (key, fallback) => STORE.read(hostStateFile(key), fallback),
            write: (key, value) => STORE.write(hostStateFile(key), value),
        };

        // MARK: - Initializer
        // MARK: - Public
        // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
        function folderOf(modId) {
            return path.join(HOME.data, modId);
        }

        // Every file counts, its main process modules' included: forgetting takes them all.
        async function count(modId) {
            const seen = { count: 0, capped: false, hidden: false };
            await walk(folderOf(modId), 0, seen);
            await walk(path.join(HOME.records, modId), 0, seen);
            return seen;
        }

        // What deckit kept for a mod. Its pages' storage and its web sessions are their sessions' to clear.
        function forget(modId) {
            fs.rmSync(folderOf(modId), { recursive: true, force: true });
            fs.rmSync(path.join(HOME.records, modId), { recursive: true, force: true });
            fs.rmSync(path.join(HOME.settings, modId + '.json'), { force: true });
        }

        // MARK: - Private
        function hostStateFile(key) {
            if (!KEY.test(String(key)) || String(key).includes('..')) throw new Error('not a state key: ' + key);
            return path.join(HOME.state, 'host', key + '.json');
        }

        function recordFile(modId, key) {
            if (!KEY.test(String(key)) || String(key).includes('..')) {
                throw Object.assign(new Error('not a record key: ' + key), { kind: 'KEY' });
            }
            return path.join(HOME.records, modId, key + '.json');
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

        return { folderOf, records, settings, state, hostState, count, forget };
    }
);
