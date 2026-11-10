import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../../../deckit-sdk/deckit/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `deckit.mods`, on the handle of every mod: each request is refused with NOT_PERMITTED for a mod its channel's guard
// does not let make it, deckit.mods for each of deckit's own. `RUN` is the page's run.
export function createMods({ RUN }) {
    // MARK: - Property
    const listeners = new Set();
    let watched = false;
    let telling = false;

    // MARK: - Initializer
    // MARK: - Public
    // `added` is what the layers add, each a request `{ guard, signature, send }`, `guard` its channel's.
    // `onChange(listener)` hears that what `list()` answers may have changed, once for each change main tells in one
    // go, until its off or until `scope` is cut. It is no request, and throws its refusal: NOT_PERMITTED for a mod not
    // granted deckit.mods, then INVALID_ARGUMENT for a listener that is no function.
    function tool(added, scope) {
        const held = { mod: RUN.mod.id, granted: RUN.granted };
        const request = (name, guard, signature, send) =>
            REQUEST.requestOf(`mods.${name}`, { ...held, guard, signature }, send);
        return Object.freeze({
            ...Object.fromEntries(
                Object.entries(added).map(([name, { guard, signature, send }]) => [
                    name,
                    request(name, guard, signature, send),
                ])
            ),
            onChange: (listener) => {
                const denied = REQUEST.deniedOf({ ...held, guard: PROTOCOL.watchMods.guard });
                if (denied) throw REQUEST.refusal('call', 'NOT_PERMITTED', denied);
                if (typeof listener !== 'function')
                    throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'mods.onChange() takes a listener function');
                return scope.add(onChange(listener));
            },
            list: request('list', PROTOCOL.mods.guard, [], () => PROTOCOL.mods.invoke()),
            install: request(
                'install',
                PROTOCOL.install.guard,
                [
                    ['folder', 'string'],
                    ['options', 'object?', [['dryRun', 'boolean?']]],
                ],
                (folder, options) => PROTOCOL.install.invoke({ folder, dryRun: options?.dryRun ?? false })
            ),
            remove: request(
                'remove',
                PROTOCOL.remove.guard,
                [
                    ['id', 'string'],
                    ['erase', 'boolean'],
                ],
                (id, erase) => PROTOCOL.remove.invoke({ id, erase })
            ),
            launch: request('launch', PROTOCOL.launch.guard, [['id', 'string']], (id) =>
                PROTOCOL.launch.invoke({ id })
            ),
            quit: request('quit', PROTOCOL.quit.guard, [['id', 'string']], (id) => PROTOCOL.quit.invoke({ id })),
            relaunch: request('relaunch', PROTOCOL.relaunch.guard, [['id', 'string']], (id) =>
                PROTOCOL.relaunch.invoke({ id })
            ),
            pin: request(
                'pin',
                PROTOCOL.pin.guard,
                [
                    ['interface', 'string'],
                    ['mod', 'string?'],
                ],
                (named, mod) => PROTOCOL.pin.invoke({ interface: named, mod: mod ?? null })
            ),
            usage: request('usage', PROTOCOL.usage.guard, [['id', 'string']], (id) => PROTOCOL.usage.invoke({ id })),
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
