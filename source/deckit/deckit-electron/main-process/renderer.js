import * as CHANNEL from '../../deckit-sdk/deckit/channel/index.js';
import * as REQUEST from '../../deckit-sdk/deckit/request/index.js';
import * as EVENT_BUS from '../../deckit-sdk/deckit/event/bus.js';
import * as MOD_PERMISSION from '../../deckit-sdk/deckit/permission/index.js';
import * as DECLARED from './protocol.js';
import * as MAIN_PROCESS_PERMISSION from './model/permission.js';
import * as MAIN_PROCESS_LAYER from './model/layer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The main process modules' layer over deckit on a mod's page, by its name, as a host app's preload hands it to
// deckit-shell's start (deckit-shell/deckit/connect/renderer.js: layers). The layer has no lifecycle of its own. It
// hands every lifecycle of the run the handle `mainProcess`, made with that lifecycle's scope: `start(path)`, the
// mod's module at `path` in its folder, for a mod with system.main-process; and, for a mod with deckit.mods,
// `restartPending()`, `stateOf(id)` and `onChange(listener)`. `channels` binds the layer's channels.
const LAYERS = Object.freeze({
    [MAIN_PROCESS_LAYER.LAYER]:
        ({ channels }) =>
        ({ mod, granted, deliver }) => {
            const MAIN_PROCESS = createMainProcess({ mod, granted, deliver, channels });
            return { frameworks: { [MAIN_PROCESS_LAYER.LAYER]: MAIN_PROCESS.forScope } };
        },
});

// MARK: - Private
// The main process modules of a mod's page: each module started once, however many handles ask for it. `deliver` runs
// a listener of the mod's and records what it throws.
function createMainProcess({ mod, granted, deliver, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const buses = new Map(); // a module's path -> what listens to what it emits
    const started = new Map(); // the path asked for -> promise of what the module answers it has
    const changeListeners = new Set(); // told when what `restartPending` or `stateOf` answer may have changed
    let listening = false;
    let watched = false;

    // MARK: - Initializer
    // MARK: - Public
    // The handle `mainProcess`: a module, started once, its methods called through main, and `on(name, listener)`
    // for what it emits, heard until `scope` is cut. A start that failed is tried again the next time it is asked
    // for. `onChange` is no request, and throws its refusal: NOT_PERMITTED for a mod not granted deckit.mods, then
    // INVALID_ARGUMENT for a listener that is no function.
    function forScope(scope) {
        const managerDenied = deniedWithout(MOD_PERMISSION.MODS);
        const manager = (name, signature, send) =>
            REQUEST.requestOf(`mainProcess.${name}`, { denied: managerDenied, signature }, send);
        return Object.freeze({
            start: REQUEST.requestOf(
                'mainProcess.start',
                { denied: deniedWithout(MAIN_PROCESS_PERMISSION.MAIN_PROCESS), signature: [['path', 'string']] },
                (path) => moduleOf(path, scope)
            ),
            restartPending: manager('restartPending', [], () => PROTOCOL.restartPending.invoke()),
            stateOf: manager('stateOf', [['id', 'string']], (id) => PROTOCOL.stateOf.invoke({ id })),
            onChange: (listener) => {
                if (managerDenied) throw REQUEST.refusal('call', 'NOT_PERMITTED', managerDenied);
                if (typeof listener !== 'function')
                    throw REQUEST.refusal(
                        'call',
                        'INVALID_ARGUMENT',
                        'mainProcess.onChange() takes a listener function'
                    );
                return scope.add(onChange(listener));
            },
        });
    }

    // MARK: - Private
    // Why the mod may not make a request `permission` guards, or ''.
    function deniedWithout(permission) {
        return granted.includes(permission) ? '' : `${mod.id} does not have the ${permission} permission`;
    }

    function busOf(path) {
        if (!buses.has(path))
            buses.set(
                path,
                EVENT_BUS.make({ call: (listener, args, name) => deliver(`on("${name}")`, listener, ...args) })
            );
        return buses.get(path);
    }

    function describedOf(path) {
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
    }

    async function moduleOf(path, scope) {
        const { path: relative, methods } = await describedOf(path);
        const proxy = proxyOf(methods, (method, args) => PROTOCOL.call.invoke({ path: relative, method, args }));
        proxy.on = (name, listener) => scope.add(busOf(relative).on(name, listener));
        return deepFreeze(proxy);
    }

    function onChange(listener) {
        if (!watched) {
            watched = true;
            PROTOCOL.changed.on(() => {
                for (const each of [...changeListeners])
                    if (changeListeners.has(each)) deliver('mainProcess.onChange listener', each);
            });
            PROTOCOL.watch.send();
        }
        changeListeners.add(listener);
        return () => changeListeners.delete(listener);
    }

    return { forScope };
}

// An object with a function at each path that calls the module's method by its path. A path names the object's own
// properties, defined rather than assigned: a name such as `__proto__` is a property like any other, never the page's
// prototypes.
function proxyOf(functions, call) {
    const out = {};
    const own = (at, key, value) =>
        Object.defineProperty(at, key, { value, enumerable: true, writable: true, configurable: true });
    for (const path of functions) {
        let at = out;
        for (const key of path.slice(0, -1)) {
            if (!Object.hasOwn(at, key)) own(at, key, {});
            at = at[key];
        }
        own(at, path.at(-1), (...args) => call(path, args));
    }
    return out;
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) deepFreeze(inner);
    }
    return value;
}

export { LAYERS };
