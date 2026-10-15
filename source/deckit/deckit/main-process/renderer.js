export function createMainProcess({ PROTOCOL, proxyOf, deepFreeze }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // deck.mainProcess(path): the module started once, its methods called through main, `on(name, listener)` for
    // what it emits. A start that failed is tried again the next time it is asked for. `deliver` runs a listener
    // of the mod's and records what it throws.
    function forMod({ deliver }) {
        const listeners = new Map(); // a module's path -> event name -> Set of what listens to what it emits
        const listenersOf = (path, name) => {
            if (!listeners.has(path)) listeners.set(path, new Map());
            const named = listeners.get(path);
            if (!named.has(name)) named.set(name, new Set());
            return named.get(name);
        };
        const started = new Map(); // the path asked for -> promise of the module's proxy
        PROTOCOL.event.on(({ path, name, args }) => {
            const told = listenersOf(path, name);
            for (const listener of [...told]) if (told.has(listener)) deliver(`on("${name}")`, listener, ...args);
        });
        const moduleOf = ({ path, methods }) => {
            const proxy = proxyOf(methods, {}, (method, args) => PROTOCOL.call.invoke({ path, method, args }));
            proxy.on = (name, listener) => {
                listenersOf(path, name).add(listener);
                return () => listenersOf(path, name).delete(listener);
            };
            return deepFreeze(proxy);
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

    return { forMod, restartPending };
}
