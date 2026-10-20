export function createStorage({ HOME, CORE, LOG }) {
    // MARK: - Property
    const fs = require('fs');
    const path = require('path');
    const COUNT_LIMIT = 1000;
    // The state the core keeps, as it gave it when deck prepared: folder (null for the state folder) -> key -> JSON.
    const kept = new Map();
    let unread = null; // why the state was not read, if it was not

    // A mod's settings, which the core keeps outside the mod's folder, a value saved among the mod's others.
    const settings = Object.freeze({
        read: (modId) => CORE.request('setting/read', { mod: modId }),
        // Whether the value changed.
        write: (modId, key, value) => CORE.request('setting/write', { mod: modId, key, value }),
        erase: (modId) => CORE.request('setting/erase', { mod: modId }),
    });

    // What the person arranged and what deck and the layers on it keep between runs, one JSON file a key.
    const state = stateIn(null);

    // MARK: - Initializer
    // MARK: - Public
    // The state the core keeps, read once, before anything reads it. State the core could not give reads as none, and
    // is not written over.
    async function load() {
        const entries = await CORE.request('state/all').catch((error) => {
            LOG.error('the state deck keeps was not read', error);
            unread = error;
            return [];
        });
        for (const { folder = null, key, text } of entries) textsIn(folder).set(key, text);
    }

    // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
    function folderOf(modId) {
        return path.join(HOME.data, modId);
    }

    // Every file of the mod's data folder counts, whatever wrote it: erasing takes them all.
    async function count(modId) {
        const seen = { count: 0, capped: false, hidden: false };
        await walk(folderOf(modId), 0, seen);
        return seen;
    }

    // The mod's data folder. What the core keeps for it is the core's to erase, and its pages' storage and its web
    // sessions their sessions' to clear.
    function erase(modId) {
        fs.rmSync(folderOf(modId), { recursive: true, force: true });
    }

    // The state in `folder`, a folder of its own one down for one who names its keys as it likes (the host app), or
    // null for the state folder. A read answers from what the core keeps at once. A write answers once the core has
    // kept it, and one it refused is taken back, unless the key was written again since.
    function stateIn(folder) {
        const texts = textsIn(folder);
        return Object.freeze({
            read: (key, fallback = null) => {
                const text = texts.get(key);
                return text === undefined ? fallback : valueOf(text, fallback);
            },
            write: (key, value) => {
                const before = texts.get(key);
                const text = JSON.stringify(value);
                texts.set(key, text);
                const written = unread ? Promise.reject(unread) : CORE.request('state/write', { folder, key, text });
                written.catch((error) => {
                    LOG.error(`state ${key} was not kept`, error);
                    if (texts.get(key) !== text) return;
                    if (before === undefined) texts.delete(key);
                    else texts.set(key, before);
                });
                return written;
            },
        });
    }

    // MARK: - Private
    function textsIn(folder) {
        if (!kept.has(folder)) kept.set(folder, new Map());
        return kept.get(folder);
    }

    // A file that is not JSON (one edited by hand) holds no value.
    function valueOf(text, fallback) {
        try {
            return JSON.parse(text);
        } catch {
            return fallback;
        }
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

    return { load, folderOf, settings, state, stateIn, count, erase };
}
