import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';
import * as PROXY from '../export/proxy.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's extension points in its page, and how it answers a call into what it extends another's with. `RUN` is the
// page's run.
export function createExtension({ RUN }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // One of the mod's extension points. `extensions()` is what extends it now, by the id of the mod that extends
    // it, each one's functions called through main; `onChange(listener)` hears what it is each time it changes, and
    // answers its off. Nothing extends it before start() has ended: what extends it is added once the mod has
    // started.
    function pointOf(name) {
        const point = SCOPED.scopedName(RUN.mod.id, name);
        const listeners = new Set();
        let extensions = Object.freeze({});
        return {
            handle: Object.freeze({
                extensions: () => extensions,
                onChange(listener) {
                    if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                },
            }),
            set(given) {
                extensions = Object.freeze(
                    Object.fromEntries(
                        Object.entries(given).map(([id, { values, functions }]) => [
                            id,
                            PROXY.deepFreeze(
                                PROXY.proxyOf(functions, JSON.parse(values), (path, args) =>
                                    PROTOCOL.callExtension.invoke({ run: RUN.number, mod: id, point, path, args })
                                )
                            ),
                        ])
                    )
                );
                for (const listener of listeners) RUN.deliver('onChange()', listener, extensions);
            },
        };
    }

    // Once the mod has started: calls into what it extends others' points with, and what extends its own points.
    // `points` is its points by name, as pointOf made them.
    function answer(extend, points) {
        PROTOCOL.extensionCalled.handle(({ point, path, args }) => {
            const extension = path.reduce((at, key) => at?.[key], extend?.[point]);
            if (typeof extension !== 'function')
                throw new Error(`${RUN.mod.id} extends ${point} with no function ${path.join('.')}`);
            return extension(...args);
        });
        PROTOCOL.extensionsChanged.on(({ name, extensions }) => points.get(name)?.set(extensions));
    }

    // MARK: - Private

    return { pointOf, answer };
}
