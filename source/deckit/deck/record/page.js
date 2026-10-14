import * as PROTOCOL from './protocol.js';

export function createRecord() {
    // MARK: - Property
    // What get() answers, synchronously. It never holds what the file will not: a write main refuses puts back what
    // was there, and it holds and answers copies as the file has them, so a value changed in place is not kept.
    const cache = new Map(); // key -> value, undefined for none

    // MARK: - Initializer
    // MARK: - Public
    // Small state that costs a click to lose (a fold, a width), in the view's own storage: its origin is the
    // mod's, so no other mod reads it.
    function values() {
        return {
            get(key, fallback) {
                const stored = localStorage.getItem(String(key));
                return stored === null ? fallback : JSON.parse(stored);
            },
            set(key, value) {
                localStorage.setItem(String(key), JSON.stringify(value));
            },
            remove(key) {
                localStorage.removeItem(String(key));
            },
        };
    }

    // What must not be lost: JSON by key in the mod's folder, written whole by main. `fail` hears a write
    // that did not land.
    function records(fail) {
        const write = (key, given, send) => {
            let value;
            try {
                value = copyOf(given);
            } catch (error) {
                fail(`could not keep "${key}": ${error.message}`);
                return Promise.reject(error);
            }
            const had = cache.has(key);
            const before = cache.get(key);
            cache.set(key, value);
            return send(value).catch((error) => {
                // Put back only what this write put there: a later write to the same key answers for itself.
                if (cache.get(key) === value) {
                    if (had) cache.set(key, before);
                    else cache.delete(key);
                }
                fail(`could not keep "${key}": ${error.message}`);
                throw error;
            });
        };
        return {
            get(key, fallback) {
                if (!cache.has(key)) cache.set(key, PROTOCOL.readRecord.invoke({ key: String(key) }) ?? undefined);
                const value = cache.get(key);
                return copyOf(value === undefined ? fallback : value);
            },
            set: (key, given) =>
                write(String(key), given, (value) => PROTOCOL.writeRecord.invoke({ key: String(key), value })),
            remove: (key) => write(String(key), undefined, () => PROTOCOL.removeRecord.invoke({ key: String(key) })),
            keys: () => PROTOCOL.recordKeys.invoke(),
        };
    }

    // MARK: - Private
    // A record as its file holds it: JSON, read back.
    function copyOf(value) {
        if (value === undefined) return undefined;
        const text = JSON.stringify(value);
        if (text === undefined) throw new Error('it is no JSON value');
        return JSON.parse(text);
    }

    return { values, records };
}
