import * as EVENT_BUS from '../../deck/event/bus.js';
import * as PROXY from '../../deck/export/proxy.js';
import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// The main process modules of a mod's page: each module started once, however many handles ask for it. `deliver` runs
// a listener of the mod's and records what it throws.
function createMainProcess({ deliver }) {
    const buses = new Map(); // a module's path -> what listens to what it emits
    const started = new Map(); // the path asked for -> promise of what the module answers it has
    let listening = false;
    const busOf = (path) => {
        if (!buses.has(path))
            buses.set(
                path,
                EVENT_BUS.make({ call: (listener, args, name) => deliver(`on("${name}")`, listener, ...args) })
            );
        return buses.get(path);
    };
    const describedOf = (path) => {
        if (!listening) {
            listening = true;
            PROTOCOL.event.on(({ path: from, name, args }) => busOf(from).emit(name, ...args));
        }
        if (!started.has(path)) {
            const starting = PROTOCOL.start.invoke({ path });
            starting.catch(() => started.get(path) === starting && started.delete(path));
            started.set(path, starting);
        }
        return started.get(path);
    };
    // `deckit.mainProcess(path)` for a handle: the module, started once, its methods called through main, and
    // `on(name, listener)` for what it emits, heard until `scope` is cut. A start that failed is tried again the
    // next time it is asked for.
    function forScope(scope) {
        return (path) =>
            describedOf(String(path)).then(({ path: started, methods }) => {
                const proxy = PROXY.proxyOf(methods, {}, (method, args) =>
                    PROTOCOL.call.invoke({ path: started, method, args })
                );
                proxy.on = (name, listener) => {
                    const off = busOf(started).on(name, listener);
                    scope.add(off);
                    return off;
                };
                return PROXY.deepFreeze(proxy);
            });
    }
    return { forScope };
}

function restartPending() {
    return PROTOCOL.restartPending.invoke();
}

// MARK: - Private

export { createMainProcess, restartPending };
