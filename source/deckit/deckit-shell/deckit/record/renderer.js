import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../../../deckit-sdk/deckit/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createRecord() {
    // MARK: - Property
    // What get() answers, synchronously. It never holds what the file will not: a write main refuses puts back what
    // was there, and it holds and answers copies as the file has them, so a value changed in place is not kept.
    const cache = new Map(); // key -> value, undefined for none

    // MARK: - Initializer
    // MARK: - Public
    // Small state that costs little to lose, in the page's own storage: its origin is the mod's, so no other mod
    // reads it. Each answers at once, and throws its refusal: INVALID_ARGUMENT for a key that is no string, or a value
    // left out or that is no value (REQUEST.valueProblem), and QUOTA_EXCEEDED once the storage has no room for it.
    function values() {
        return {
            get(key, fallback) {
                const stored = localStorage.getItem(keyOf('values.get', key));
                return stored === null ? fallback : JSON.parse(stored);
            },
            set(key, value) {
                const named = keyOf('values.set', key);
                const text = textOf('values.set', value);
                try {
                    localStorage.setItem(named, text);
                } catch (error) {
                    if (error?.name !== 'QuotaExceededError') throw error;
                    throw REQUEST.refusal('call', 'QUOTA_EXCEEDED', `storage.values.set: no room for "${named}"`);
                }
            },
            remove(key) {
                localStorage.removeItem(keyOf('values.remove', key));
            },
        };
    }

    // What must not be lost: JSON by key in the mod's folder, written whole by main. `get` and `keys` answer at once,
    // and `get` throws its refusal; `set` and `remove` are requests, refused INVALID_ARGUMENT for a key that is no
    // string, or a value left out or that is no value (REQUEST.valueProblem), and as main refuses the write.
    function records() {
        const write = (key, value, send) => {
            const had = cache.has(key);
            const before = cache.get(key);
            cache.set(key, value);
            return send(value).catch((error) => {
                // Put back only what this write put there: a later write to the same key answers for itself.
                if (cache.get(key) === value) {
                    if (had) cache.set(key, before);
                    else cache.delete(key);
                }
                throw error;
            });
        };
        const refused = (work) => {
            try {
                return work();
            } catch (error) {
                return Promise.reject(error);
            }
        };
        return {
            get(key, fallback) {
                const named = keyOf('records.get', key);
                if (!cache.has(named)) cache.set(named, PROTOCOL.readRecord.invoke({ key: named }) ?? undefined);
                const value = cache.get(named);
                return copyOf(value === undefined ? fallback : value);
            },
            set: (key, given) =>
                refused(() => {
                    const named = keyOf('records.set', key);
                    const value = JSON.parse(textOf('records.set', given));
                    return write(named, value, () => PROTOCOL.writeRecord.invoke({ key: named, value }));
                }),
            remove: (key) =>
                refused(() => {
                    const named = keyOf('records.remove', key);
                    return write(named, undefined, () => PROTOCOL.removeRecord.invoke({ key: named }));
                }),
            keys: () => PROTOCOL.recordKeys.invoke(),
        };
    }

    // MARK: - Private
    function keyOf(member, key) {
        if (typeof key !== 'string') throw invalid(`storage.${member}: key is ${typeof key}, not a string`);
        return key;
    }

    // The JSON text of `value`, a value that is not left out.
    function textOf(member, value) {
        const problem = REQUEST.argumentProblem([['value', 'value']], [value]);
        if (problem) throw invalid(`storage.${member}: ${problem}`);
        return JSON.stringify(value);
    }

    function invalid(message) {
        return REQUEST.refusal('call', 'INVALID_ARGUMENT', message);
    }

    // A record as its file holds it: JSON, read back.
    function copyOf(value) {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    return { values, records };
}
