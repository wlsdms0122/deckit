import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `deck.mods` for a mod with deckit.mods. `RUN` is the page's run.
export function createMods({ RUN }) {
    // MARK: - Property
    const listeners = new Set();
    let watched = false;
    let telling = false;

    // MARK: - Initializer
    // MARK: - Public
    // `added` is what is on deck adds. `onChange(listener)` hears that what `list()` answers may have changed, once
    // for each change main tells in one go, and answers its off.
    function tool(added) {
        return Object.freeze({
            ...added,
            onChange,
            list: () => PROTOCOL.mods.invoke(),
            install: (from) => PROTOCOL.install.invoke({ from: String(from) }),
            remove: (id, data) => PROTOCOL.remove.invoke({ id: String(id), data: !!data }),
            relaunch: (id) => PROTOCOL.relaunch.invoke({ id: String(id) }),
            load: (ids) => PROTOCOL.load.invoke({ ids: Array.from(ids, String) }),
            arrange: (ids) => PROTOCOL.arrange.invoke({ ids: Array.from(ids, String) }),
            usage: (id) => PROTOCOL.usage.invoke({ id: String(id) }),
        });
    }

    // MARK: - Private
    function onChange(listener) {
        if (!watched) {
            watched = true;
            PROTOCOL.modsChanged.on(() => {
                if (telling) return;
                telling = true;
                setTimeout(() => {
                    telling = false;
                    for (const each of listeners) RUN.deliver('mods.onChange listener', each);
                });
            });
            PROTOCOL.watchMods.send();
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    return { tool };
}
