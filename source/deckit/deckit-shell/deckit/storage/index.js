export function createStorage({ CORE, LOG }) {
    // MARK: - Property
    // The state the core keeps, as it gave it when `load()` read it: folder (null for the state folder) -> key ->
    // JSON.
    const kept = new Map();
    let unread = new Error('the state the core keeps was not read'); // why the state is not read, until load() reads it

    // What the person arranged and what deckit and the layers on it keep between runs, one JSON file a key.
    const state = stateIn(null);

    // MARK: - Initializer
    // MARK: - Public
    // The state the core keeps, read once, before anything reads it. State not read, as the core could not give it or
    // as it was never asked, reads as none and is not written over.
    async function load() {
        let entries;
        try {
            entries = await CORE.request('state/all');
        } catch (error) {
            LOG.error('the state the core keeps was not read', error);
            unread = error;
            return;
        }
        for (const { folder = null, key, text } of entries) textsIn(folder).set(key, text);
        unread = null;
    }

    // The state in `folder`, a folder of its own one down for one who names its keys as it likes (the host app), or
    // null for the state folder. A read answers from what the core keeps at once. A write answers once the core has
    // kept it, and one refused is taken back, unless the key was written again since. A write to state not read is
    // refused with why it was not, which is logged where that is.
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
                const written = unread ? Promise.reject(unread) : keep(folder, key, text);
                written.catch(() => {
                    if (texts.get(key) !== text) return;
                    if (before === undefined) texts.delete(key);
                    else texts.set(key, before);
                });
                return written;
            },
        });
    }

    // MARK: - Private
    function keep(folder, key, text) {
        return CORE.request('state/write', { folder, key, text }).catch((error) => {
            LOG.error(`state ${key} was not kept`, error);
            throw error;
        });
    }

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

    return { load, state, stateIn };
}
