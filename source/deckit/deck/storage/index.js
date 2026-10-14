import * as STORE from '../../core/store/index.js';

export function createStorage({ HOME }) {
    // MARK: - Property
    const fs = require('fs');
    const path = require('path');
    // A key names a file, and a Mac's disk is blind to case: lower case only, as a mod id is.
    const KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
    const COUNT_LIMIT = 1000;

    // A mod's records: JSON by key, kept by deck apart from the mod's own data folder.
    const records = {
        read: (modId, key) => STORE.read(recordFile(modId, key)),
        write: (modId, key, value) => STORE.write(recordFile(modId, key), value),
        remove: (modId, key) => STORE.remove(recordFile(modId, key)),
        keys: (modId) => keysOf(path.join(HOME.records, modId)),
    };

    // A mod's settings are deck's to keep, so they live outside the mod's folder.
    const settings = {
        read: (modId) => STORE.read(path.join(HOME.settings, modId + '.json'), {}),
        write: (modId, values) => STORE.write(path.join(HOME.settings, modId + '.json'), values),
    };

    // What the person arranged, one JSON file a key: the mod order, and what is on deck keeps.
    const state = {
        read: (key, fallback) => STORE.read(path.join(HOME.state, key + '.json'), fallback),
        write: (key, value) => STORE.write(path.join(HOME.state, key + '.json'), value),
    };

    // MARK: - Initializer
    // MARK: - Public
    // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
    function folderOf(modId) {
        return path.join(HOME.data, modId);
    }

    // Every file counts, whatever wrote it: erasing takes them all.
    async function count(modId) {
        const seen = { count: 0, capped: false, hidden: false };
        await walk(folderOf(modId), 0, seen);
        await walk(path.join(HOME.records, modId), 0, seen);
        return seen;
    }

    // What deck kept for a mod. Its pages' storage and its web sessions are their sessions' to clear.
    function erase(modId) {
        fs.rmSync(folderOf(modId), { recursive: true, force: true });
        fs.rmSync(path.join(HOME.records, modId), { recursive: true, force: true });
        fs.rmSync(path.join(HOME.settings, modId + '.json'), { force: true });
    }

    // MARK: - Private
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

    return { folderOf, records, settings, state, count, erase };
}
