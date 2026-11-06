import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's configuration in its page. `RUN` is the page's run.
export function createConfiguration({ RUN }) {
    // MARK: - Property
    const listeners = new Set();
    let values = {}; // what each key reads as, as the core answered
    let loaded = Promise.resolve();

    // MARK: - Initializer
    // MARK: - Public
    // What each key the mod's contributes declares reads as, as the core answers: what was saved, or the default
    // when nothing it takes was. `ready` settles once it has answered.
    function load() {
        loaded = PROTOCOL.values.invoke().then(
            (read) => {
                values = { ...read };
            },
            (error) => RUN.fail(`its configuration was not read: ${error.message || error}`)
        );
        PROTOCOL.changed.on(({ key, value }) => {
            if (value === undefined || value === null) delete values[key];
            else values[key] = value;
            for (const listener of listeners) RUN.deliver('configuration.on()', listener, key, value);
        });
    }

    // `deckit.configuration` for a handle: `get(key)`; `set(key, value)`, null unsetting it, so it reads as its default
    // again; and `on(listener)`, which hears each value that changes, until its off or until `scope` is cut.
    function forScope(scope) {
        return Object.freeze({
            get: (key) => values[key],
            set: (key, value) =>
                Promise.resolve()
                    .then(() => PROTOCOL.set.invoke({ key: String(key), value: given(value) }))
                    .catch((error) => {
                        RUN.fail(`could not set "${key}": ${error.message}`);
                        throw error;
                    }),
            on(listener) {
                listeners.add(listener);
                return scope.add(() => listeners.delete(listener));
            },
        });
    }

    // MARK: - Private

    return {
        load,
        forScope,
        get ready() {
            return loaded;
        },
    };
}

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// `deckit.modConfiguration` for a mod with deckit.mod-configuration: every mod's configuration. `list()` answers, for
// each mod that declares any, `{ id, name, items }`, each item its declaration and the value it reads as; `set(id, key,
// value)`, null unsetting it, answers what it reads as now.
function tool() {
    return Object.freeze({
        list: () => PROTOCOL.list.invoke(),
        set: (id, key, value) =>
            Promise.resolve().then(() =>
                PROTOCOL.setOf.invoke({ mod: String(id), key: String(key), value: given(value) })
            ),
    });
}

// MARK: - Private
// The value a set gives: one left out is refused, as null is what unsets.
function given(value) {
    if (value === undefined) throw new Error('takes a value, or null to unset it');
    return value;
}

export { tool };
