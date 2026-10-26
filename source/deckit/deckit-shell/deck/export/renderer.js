import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as PROXY from './proxy.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// What a mod's page reaches of the mods it requires, and how it answers a call into its own exports. `RUN` is the
// page's run.
export function createExport({ RUN }) {
    // MARK: - Property
    let caller = null; // the mod whose call into this mod's exports is running, in its synchronous part

    // MARK: - Initializer
    // MARK: - Public
    // What each mod it requires exports: values copied and frozen, functions called through main. Null when main
    // refused them, as when one it requires does not run.
    async function requiresOf() {
        let given;
        try {
            given = await PROTOCOL.requires.invoke({ run: RUN.number });
        } catch (error) {
            RUN.fail(error.message || String(error));
            return null;
        }
        const out = {};
        for (const [id, exported] of Object.entries(given)) out[id] = exportsOf(id, exported);
        return Object.freeze(out);
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

    return { requiresOf, callerNow, answer };
}
