import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's configuration in its page. `RUN` is the page's run.
export function createConfiguration({ RUN }) {
    // MARK: - Property
    const listeners = new Set();
    let values = {}; // what each key reads as, as the core answered
    let declared = Promise.resolve();

    // MARK: - Initializer
    // MARK: - Public
    // What the mod's class declares, `{ key: { type, title, description, default, oneOf, minimum, maximum } }`, told
    // main as its entry is read. The core judges it and answers what each value reads as: what was saved, or the
    // default when nothing it takes was. `ready` settles once it has.
    function declare(configuration) {
        const declarations = Object.entries(
            configuration && typeof configuration === 'object' ? configuration : {}
        ).map(([key, declaration]) => ({ ...dataOf(declaration), key }));
        declared = PROTOCOL.declare.invoke({ run: RUN.number, configuration: declarations }).then(
            (read) => {
                values = { ...read };
            },
            (error) => RUN.fail(`its configuration was not declared: ${error.message || error}`)
        );
        PROTOCOL.changed.on(({ key, value }) => {
            if (value === undefined || value === null) delete values[key];
            else values[key] = value;
            for (const listener of listeners) RUN.deliver('configuration.on()', listener, key, value);
        });
    }

    // `deckit.configuration` for a handle: `get(key)`, `set(key, value)`, and `on(listener)`, which hears each value
    // that changes, until its off or until `scope` is cut.
    function forScope(scope) {
        return Object.freeze({
            get: (key) => values[key],
            set: (key, value) =>
                PROTOCOL.set.invoke({ key: String(key), value }).catch((error) => {
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
        declare,
        forScope,
        get ready() {
            return declared;
        },
    };
}

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// `deckit.modConfiguration` for a mod with deckit.mod-configuration: every mod's configuration. `list()` answers, for
// each mod that declares any, `{ id, name, items }`, each item its declaration and the value it reads as; `set(id, key,
// value)` answers the value as kept.
function tool() {
    return Object.freeze({
        list: () => PROTOCOL.list.invoke(),
        set: (id, key, value) => PROTOCOL.setOf.invoke({ mod: String(id), key: String(key), value }),
    });
}

// MARK: - Private
// A declaration as data: what JSON does not hold is left out, which the core then reads as missing.
function dataOf(declaration) {
    try {
        return JSON.parse(JSON.stringify(declaration ?? {}));
    } catch {
        return {};
    }
}

export { tool };
