export function createStorage({ CORE, LOG }) {
    // MARK: - Property
    // The state the core keeps, as it gave it when `load()` read it: folder (null for the state folder) -> key ->
    // JSON.
    const kept = new Map();
    let unread = null; // why the state was not read, if it was not

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

    // Every file of the mod's data folder counts, whatever wrote it, as erasing takes them all: { count, capped,
    // hidden }.
    function count(modId) {
        return CORE.request('data/count', { mod: modId });
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

    return { load, state, stateIn, count };
}
