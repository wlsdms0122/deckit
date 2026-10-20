import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';
import * as PROXY from './proxy.js';

const PROTOCOL = CHANNEL.bindAll(IPC, DECLARED);

// What a mod's page reaches of the mods it requires and uses optionally, and how it answers a call into its own
// exports. `RUN` is the page's run.
export function createExport({ RUN }) {
    // MARK: - Property
    let caller = null; // the mod whose call into this mod's exports is running, in its synchronous part

    // MARK: - Initializer
    // MARK: - Public
    // What each mod it requires exports: values copied and frozen, functions called through main. Its optional
    // dependencies are set on `optional` as they are now. Null when main refused them, as when one it requires did not
    // start.
    async function requiresOf(optional) {
        let given;
        try {
            given = await PROTOCOL.dependencies.invoke({ run: RUN.number });
        } catch (error) {
            RUN.fail(error.message || String(error));
            return null;
        }
        for (const [id, exported] of Object.entries(given.optional)) optional.set(id, exported);
        const out = {};
        for (const [id, exported] of Object.entries(given.requires)) out[id] = exportsOf(id, exported);
        return Object.freeze(out);
    }

    // Each optional dependency, as a handle: `exports()` is what that one exports while it runs, or null;
    // `onChange(listener)` hears it each time that one launches or ends, and answers its off. Listening starts
    // before what it is now is asked, so no change falls between.
    function optionalOf() {
        const handles = {};
        const sides = new Map(); // id -> { set }
        for (const id of Object.keys(RUN.mod.optional)) {
            const listeners = new Set();
            let current = null;
            sides.set(id, {
                set(exported) {
                    const next = exported ? exportsOf(id, exported) : null;
                    if (!next && !current) return;
                    current = next;
                    for (const listener of listeners) RUN.deliver('onChange()', listener, current);
                },
            });
            handles[id] = Object.freeze({
                exports: () => current,
                onChange(listener) {
                    if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                },
            });
        }
        PROTOCOL.optionalChanged.on(({ id, exports }) => sides.get(id)?.set(exports));
        return { handles: Object.freeze(handles), set: (id, exported) => sides.get(id)?.set(exported) };
    }

    // The mod that called one of this mod's exports, while the function runs to its first await.
    function callerNow() {
        if (caller === null)
            throw new Error("deck.caller() is read while a call into the mod's exports runs, before its first await");
        return caller;
    }

    // Calls into what the mod exports, once it has started.
    function answer(exports) {
        PROTOCOL.exportCalled.handle(({ caller: from, path, args }) => {
            const exported = path.reduce((at, key) => at?.[key], exports);
            if (typeof exported !== 'function') throw new Error(`${RUN.mod.id} exports no function ${path.join('.')}`);
            caller = from;
            try {
                return exported(...args);
            } finally {
                caller = null;
            }
        });
    }

    // MARK: - Private
    function exportsOf(id, exported) {
        return PROXY.deepFreeze(
            PROXY.proxyOf(exported.functions, JSON.parse(exported.values), (path, args) =>
                PROTOCOL.callExport.invoke({ run: RUN.number, mod: id, path, args })
            )
        );
    }

    return { requiresOf, optionalOf, callerNow, answer };
}
