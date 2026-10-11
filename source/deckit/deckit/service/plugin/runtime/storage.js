DeckitModule.define(
    'deckit/service/plugin/runtime/storage',
    {
        uses: ['deckit/service/plugin/host/model/protocol'],
        provides: ['values', 'records'],
        runs: 'page',
    },
    (PROTOCOL) => {
        // MARK: - Property
        // What get() answers. It is synchronous because make() is, so it must never hold what the file will not: a
        // write main refuses puts back what was there.
        const cache = new Map(); // key -> value, undefined for none

        // MARK: - Initializer
        // MARK: - Public
        // Small state that costs a click to lose (a fold, a width), in the view's own storage: its origin is the
        // plugin's, so no other plugin reads it.
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

        // What must not be lost: JSON by key in the plugin's folder, written whole by main. `fail` hears a write
        // that did not land.
        function records(fail) {
            const write = (key, value, send) => {
                const had = cache.has(key);
                const before = cache.get(key);
                cache.set(key, value);
                return send().catch((error) => {
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
                    return value === undefined ? fallback : value;
                },
                set: (key, value) =>
                    write(String(key), value, () => PROTOCOL.writeRecord.invoke({ key: String(key), value })),
                remove: (key) =>
                    write(String(key), undefined, () => PROTOCOL.removeRecord.invoke({ key: String(key) })),
                keys: () => PROTOCOL.recordKeys.invoke(),
                path: (key = '') => PROTOCOL.recordPath.invoke(key ? { key: String(key) } : {}),
            };
        }

        // MARK: - Private

        return { values, records };
    }
);
