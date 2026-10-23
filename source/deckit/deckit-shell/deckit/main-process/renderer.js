import * as EVENT_BUS from '../../deck/event/bus.js';
import * as PROXY from '../../deck/export/proxy.js';
import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// deck.mainProcess(path): the module started once, its methods called through main, `on(name, listener)` for
// what it emits. A start that failed is tried again the next time it is asked for. `deliver` runs a listener
// of the mod's and records what it throws.
function forMod({ deliver }) {
    const buses = new Map(); // a module's path -> what listens to what it emits
    const busOf = (path) => {
        if (!buses.has(path))
            buses.set(
                path,
                EVENT_BUS.make({ call: (listener, args, name) => deliver(`on("${name}")`, listener, ...args) })
            );
        return buses.get(path);
    };
    const started = new Map(); // the path asked for -> promise of the module's proxy
    PROTOCOL.event.on(({ path, name, args }) => busOf(path).emit(name, ...args));
    const moduleOf = ({ path, methods }) => {
        const proxy = PROXY.proxyOf(methods, {}, (method, args) => PROTOCOL.call.invoke({ path, method, args }));
        proxy.on = (name, listener) => busOf(path).on(name, listener);
        return PROXY.deepFreeze(proxy);
    };
    return (path) => {
        const asked = String(path);
        if (!started.has(asked)) {
            const starting = PROTOCOL.start.invoke({ path: asked }).then(moduleOf);
            starting.catch(() => started.get(asked) === starting && started.delete(asked));
            started.set(asked, starting);
        }
        return started.get(asked);
    };
}

function restartPending() {
    return PROTOCOL.restartPending.invoke();
}

// MARK: - Private

export { forMod, restartPending };
