// The mod's settings as `deckit/configuration` last told them, read at once: `get(key)`, null for one not read yet,
// `set(key, value)` while it is connected, and `on(listener)`, `listener(key, value)` hearing each key as it changes
// and every key as they are first read. `connect(configuration)` hands the interface over, and answers what lets it go;
// what was read stays.
function settingsOf() {
    let configuration = null;
    let values = {};
    const listeners = new Set();
    const tell = (key) => {
        for (const listener of listeners) listener(key, values[key]);
    };
    return {
        get: (key) => values[key] ?? null,
        set: async (key, value) => {
            if (!configuration) throw new Error('deckit/configuration is not connected');
            return configuration.set(key, value);
        },
        on: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        connect: async (given) => {
            configuration = given;
            await given.onChange((key, value) => {
                if (configuration !== given) return;
                values = { ...values, [key]: value };
                tell(key);
            });
            values = await given.values();
            for (const key of Object.keys(values)) tell(key);
            return () => {
                if (configuration === given) configuration = null;
            };
        },
    };
}

module.exports = { settingsOf };
