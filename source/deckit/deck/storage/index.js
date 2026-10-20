import * as STORE from './store.js';

export function createStorage({ HOME }) {
    // MARK: - Property
    const fs = require('fs');
    const path = require('path');
    // A key names a file, and a Mac's disk is blind to case: lower case only, as a mod id is.
    const KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
    const COUNT_LIMIT = 1000;

    // A mod's settings are deck's to keep, so they live outside the mod's folder.
    const settings = {
        read: (modId) => STORE.read(path.join(HOME.settings, modId + '.json'), {}),
        write: (modId, values) => STORE.write(path.join(HOME.settings, modId + '.json'), values),
    };

    // What the person arranged and what deck and the layers on it keep between runs, one JSON file a key.
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

    // What deck kept here for a mod: its records are the core's to erase, and its pages' storage and its web
    // sessions their sessions' to clear.
    function erase(modId) {
        fs.rmSync(folderOf(modId), { recursive: true, force: true });
        fs.rmSync(path.join(HOME.settings, modId + '.json'), { force: true });
    }

    // State kept in a folder of its own beside deck's, for one who names its keys as it likes: the host app.
    function stateIn(folder) {
        const file = (key) => {
            if (!KEY.test(String(key)) || String(key).includes('..')) throw new Error('not a state key: ' + key);
            return path.join(HOME.state, folder, key + '.json');
        };
        return Object.freeze({
            read: (key, fallback) => STORE.read(file(key), fallback),
            write: (key, value) => STORE.write(file(key), value),
        });
    }

    // MARK: - Private
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

    return { folderOf, settings, state, stateIn, count, erase };
}
