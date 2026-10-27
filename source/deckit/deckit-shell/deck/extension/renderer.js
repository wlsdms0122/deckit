import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';
import * as PROXY from '../export/proxy.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// A mod's extension points in its page, and how it answers a call into what it extends another's with. `RUN` is the
// page's run.
export function createExtension({ RUN }) {
    // MARK: - Property
    const points = new Map(); // a joined point's name -> the point
    const extensions = new Map(); // "<mod id>:<point>" -> the joined extension
    let answering = false;

    // MARK: - Initializer
    // MARK: - Public
    // One of the mod's extension points. `extensions()` is what extends it now, by the id of the mod that extends
    // it, each one's functions called through main; `onChange(listener)` hears what it is each time it changes, until
    // its off or until `scope` is cut. Nothing extends it before it is joined.
    function pointOf(name, scope) {
        const point = SCOPED.scopedName(RUN.mod.id, name);
        const listeners = new Set();
        let extending = Object.freeze({});
        return {
            handle: Object.freeze({
                extensions: () => extending,
                onChange(listener) {
                    if (typeof listener !== 'function') throw new Error('onChange() takes a listener function');
                    listeners.add(listener);
                    const off = () => listeners.delete(listener);
                    scope.add(off);
                    return off;
                },
            }),
            set(given) {
                extending = Object.freeze(
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
                for (const listener of listeners) RUN.deliver('onChange()', listener, extending);
            },
        };
    }

    // A lifecycle's points, by name as pointOf made them, and what it extends others' points with, by
    // "<mod id>:<point>": calls into them are answered from now on. Answers what takes them back.
    function join(joined, joinedPoints) {
        if (!answering) answer();
        for (const [name, point] of joinedPoints) points.set(name, point);
        for (const [point, extension] of Object.entries(joined)) extensions.set(point, extension);
        return () => {
            for (const name of joinedPoints.keys()) points.delete(name);
            for (const point of Object.keys(joined)) extensions.delete(point);
        };
    }

    // MARK: - Private
    function answer() {
        answering = true;
        PROTOCOL.extensionCalled.handle(({ point, path, args }) => {
            const extension = path.reduce((at, key) => at?.[key], extensions.get(point));
            if (typeof extension !== 'function')
                throw new Error(`${RUN.mod.id} extends ${point} with no function ${path.join('.')}`);
            return extension(...args);
        });
        PROTOCOL.extensionsChanged.on(({ name, extensions: given }) => points.get(name)?.set(given));
    }

    return { pointOf, join };
}
