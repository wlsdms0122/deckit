import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../permission/index.js';
import * as REQUEST from '../request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `deckit.mods`, on the handle of every mod: each request is refused with NOT_PERMITTED for a mod not granted
// deckit.mods. `RUN` is the page's run.
export function createMods({ RUN }) {
    // MARK: - Property
    const listeners = new Set();
    let watched = false;
    let telling = false;

    // MARK: - Initializer
    // MARK: - Public
    // `added` is what the layers add, each a request. `onChange(listener)` hears that what `list()` answers may have
    // changed, once for each change main tells in one go, until its off or until `scope` is cut; for a mod not
    // granted deckit.mods it throws the refusal.
    function tool(added, scope) {
        const { id, permissions } = RUN.mod;
        const granted = permissions.some((permission) => permission.id === MOD_PERMISSION.MODS);
        const denied = granted ? '' : `${id} does not have the ${MOD_PERMISSION.MODS} permission`;
        const request = (name, signature, send) => REQUEST.requestOf(`mods.${name}`, { denied, signature }, send);
        return Object.freeze({
            ...Object.fromEntries(Object.entries(added).map(([name, send]) => [name, request(name, [], send)])),
            onChange: (listener) => {
                if (denied) throw REQUEST.refusal('call', 'NOT_PERMITTED', denied);
                return scope.add(onChange(listener));
            },
            list: request('list', [], () => PROTOCOL.mods.invoke()),
            plan: request('plan', [['folder', 'string']], (folder) => PROTOCOL.plan.invoke({ folder })),
            install: request('install', [['folder', 'string']], (folder) => PROTOCOL.install.invoke({ folder })),
            remove: request(
                'remove',
                [
                    ['id', 'string'],
                    ['erase', 'boolean'],
                ],
                (id, erase) => PROTOCOL.remove.invoke({ id, erase })
            ),
            launch: request('launch', [['id', 'string']], (id) => PROTOCOL.launch.invoke({ id })),
            quit: request('quit', [['id', 'string']], (id) => PROTOCOL.quit.invoke({ id })),
            relaunch: request('relaunch', [['id', 'string']], (id) => PROTOCOL.relaunch.invoke({ id })),
            pin: request(
                'pin',
                [
                    ['interface', 'string'],
                    ['mod', 'string?'],
                ],
                (named, mod) => PROTOCOL.pin.invoke({ interface: named, mod: mod ?? null })
            ),
            usage: request('usage', [['id', 'string']], (id) => PROTOCOL.usage.invoke({ id })),
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
