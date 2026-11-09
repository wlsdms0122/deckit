import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../../../deckit-sdk/deckit/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import { makeScope } from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The run of a mod in its page: its entry evaluated, the class it exports made once and its lifecycles started in the
// order they are stacked, each connected to the interfaces it depends on as it begins, and main told the run started,
// with what they registered, once each has started. `RUN` is the page's run; `STORAGE`, `CONNECTION`, `EVENT` and
// `MODS` are what deckit gives it; `modules` is the environment's (environment/: PAGE.modules).
export function createRunner({ RUN, STORAGE, CONNECTION, EVENT, MODS, modules: MODULES }) {
    // MARK: - Property
    // What a layer gives of what it leaves out, and what the runner has when no layer is given: no lifecycle, so the
    // run starts once its class is made.
    const NOTHING = Object.freeze({
        handle: 'deck',
        read: () => ({}),
        report: () => ({}),
        mods: {},
        lifecycles: [],
        frameworks: {},
    });

    // MARK: - Initializer
    // MARK: - Public
    // The mod this page runs. `layers` is what stacks on the runner, the lowest first, each `[name, layer]`, and each
    // `layer(context)` asked with the mod (`{ mod, granted, run, deliver, fail, under }`, `mod` its manifest, whose
    // `fields` are the manifest fields the layers named, by key, which the runner carries and does not read, `granted`
    // the ids of the permissions it is granted, and `under` what each layer under it offers a layer over it, by that
    // layer's name, `{}` for the lowest) before its entry runs, and answering:
    // `read(Entry)`, what it reads of the class the entry exports, before any instance is made, as part of the
    // summary;
    // `report()`, what main is told of the run beside the runner's own now, `{ summary, contributions }`, which the
    // runner carries and does not read;
    // `lifecycles`, the lifecycles it stacks on the run, over those of the layers under it, the lowest first;
    // `over`, what it offers a layer over it;
    // `frameworks`, the handles it hands every lifecycle of the run, by name, each `handleOf(scope)` made with that
    // lifecycle's scope;
    // and, for the lowest, `handle`, the name of the handle the runner's members are on, and `mods`, the requests it
    // adds to `mods`, by name, each `{ signature, send }` as deckit-shell/deckit/request names them.
    // A lifecycle is `{ method, registrations, start(instance, handles, scope, frameworks), end(instance),
    // join(parts, scope) }`: `method` names it in what a person reads; `registrations`, by name, `{ handle, check }`,
    // what the handles it hands out register beside the runner's own; `start`, which calls the instance with its
    // handles, by name, each of the runner's members and registrations on the one named `handle`, and with
    // `frameworks`, a frozen table of the layers' frameworks made for it; `end`, which ends what start began; `join`,
    // called with what it registered once start has ended.
    // Each lifecycle has a `scope`: what its handles made that calls back into the mod's code is cut as it ends. The
    // lowest failing fails the run; another failing ends alone, none stacks on it, and the run starts with those under
    // it. A layer whose read throws is left out of the run with the layers over it, and the lowest's fails the run.
    async function start({ layers = [] } = {}) {
        try {
            await run(layers);
        } catch (error) {
            RUN.fail(`deckit could not start it: ${error.message || error}`);
            RUN.notStarted();
        }
    }

    // MARK: - Private
    async function run(layers) {
        // The lifecycles whose start was called, the lowest first, each with what its handles made. Asked to stop, the
        // run ends them, the highest first, without waiting on a start still going: a lifecycle not started by then
        // never is. Answered from the first, so a page whose mod never started does not keep main waiting.
        const begun = [];
        let instance = null;
        let stopping = null;
        PROTOCOL.stop.handle(
            () =>
                (stopping ??= (async () => {
                    for (const lifecycle of begun.slice().reverse()) await end(lifecycle, instance);
                })())
        );
        const loaded = PROTOCOL.load.invoke();
        RUN.begin(loaded);
        const mod = RUN.mod;
        const { deliver, fail } = RUN;
        const made = make(layers, { mod, granted: RUN.granted, run: RUN.number, deliver, fail });
        const Entry = evaluate(loaded.source);
        if (!Entry) return RUN.notStarted();
        let read;
        try {
            read = readOf(made, Entry);
        } catch (error) {
            fail(error.message || String(error));
            return RUN.notStarted();
        }
        const given = stacked(read.layers);
        const { described } = read;
        PROTOCOL.described.send({ run: RUN.number, summary: described, lifecycles: given.lifecycles.length });
        if (stopping) return;
        try {
            instance = new Entry();
        } catch (error) {
            fail(`its constructor threw: ${error.message || error}`);
            return RUN.notStarted();
        }
        // Name, an interface or the mod's own id -> the lifecycle that opened its exports, as the runner joins it.
        const joined = { exportedIn: {} };
        for (const [index, lifecycle] of given.lifecycles.entries()) {
            const scope = makeScope();
            const registry = registryOf(lifecycle, { handle: given.handle, joined });
            const entry = { index, lifecycle, scope, registry };
            begun.push(entry);
            const { handles } = registry;
            try {
                const dependencies = await CONNECTION.begin(index, scope);
                handles[given.handle] = { ...membersOf({ given, scope, dependencies }), ...handles[given.handle] };
                const frameworks = Object.freeze(
                    Object.fromEntries(
                        Object.entries(given.frameworks).map(([name, handleOf]) => [name, handleOf(scope)])
                    )
                );
                await lifecycle.start(instance, handles, scope, frameworks);
                if (stopping) return;
                const parts = registry.close();
                lifecycle.join(parts, scope);
                for (const [named, exports] of Object.entries(parts.exports ?? {})) {
                    CONNECTION.give(index, named, exports);
                    joined.exportedIn[named] = index;
                }
            } catch (error) {
                registry.close();
                fail(error.message || String(error));
                if (index === 0) return RUN.notStarted();
                begun.pop();
                await end(entry, instance);
                break;
            }
        }
        if (!stopping) tellStarted({ described, joined, reported: given.report() });
    }

    // Each layer made with the mod, the lowest first, each offered what every one under it offers, by its name.
    function make(layers, context) {
        const made = [];
        for (const [name, layer] of layers) {
            const under = Object.freeze(
                Object.fromEntries(made.filter((one) => one.over).map((one) => [one.name, one.over]))
            );
            made.push({ ...NOTHING, ...layer({ ...context, under }), name });
        }
        return made;
    }

    // What the layers read of the class, a lower one's where two say the same, and the layers that run: one whose read
    // throws is left out, its problem recorded, with those over it, and the lowest's throw is thrown.
    function readOf(made, Entry) {
        const reads = [];
        for (const [index, layer] of made.entries()) {
            try {
                reads.push(layer.read(Entry));
            } catch (error) {
                if (index === 0) throw error;
                RUN.fail(error.message || String(error));
                break;
            }
        }
        return { layers: made.slice(0, reads.length), described: Object.assign({}, ...reads.reverse()) };
    }

    // The layers on the runner as one: what each reports and the frameworks each hands, a lower one's where two say
    // the same, their lifecycles in order, and the lowest's handle.
    function stacked(given) {
        if (!given.length) return NOTHING;
        return {
            handle: given[0].handle,
            mods: given[0].mods,
            report: () => {
                const reports = given.map((one) => one.report()).reverse();
                return {
                    summary: Object.assign({}, ...reports.map((one) => one.summary)),
                    contributions: Object.assign({}, ...reports.map((one) => one.contributions)),
                };
            },
            lifecycles: given.flatMap((one) => one.lifecycles),
            frameworks: Object.assign({}, ...given.map((one) => one.frameworks).reverse()),
        };
    }

    // Main is told what the run contributes, all of it, and as a person reads it: `exports` in the summary is whether a
    // lifecycle opened the exports of any interface.
    function tellStarted({ described, joined, reported }) {
        const exportedIn = { ...joined.exportedIn };
        PROTOCOL.started.send({
            run: RUN.number,
            contributions: { ...reported.contributions, exportedIn, awaits: CONNECTION.awaited() },
            summary: { ...described, ...reported.summary, exports: Object.keys(exportedIn).length > 0 },
        });
    }

    // A lifecycle ends once, within its own limit, whatever its end throws, and what its handles made is cut once its
    // end has run or its time ran out, then its connections. Asked again, it answers the end already going.
    function end(entry, instance) {
        return (entry.ending ??= (async () => {
            const { index, lifecycle, scope, registry } = entry;
            registry.close();
            let timer = null;
            const ran = (async () => lifecycle.end(instance))().catch((error) =>
                RUN.fail(error.message || String(error))
            );
            const late = new Promise((resolve) => (timer = setTimeout(resolve, RUN.end)));
            await Promise.race([ran, late]);
            clearTimeout(timer);
            scope.cut();
            CONNECTION.leave(index);
        })());
    }

    // The entry runs as a CommonJS module with nothing else in reach, and exports the mod's class.
    function evaluate(source) {
        const { mod } = RUN;
        let exported = null;
        try {
            exported = MODULES.evaluate(source, { mod: mod.id, file: mod.main });
        } catch (error) {
            RUN.fail(`${mod.main} failed to load: ${error.message || error}`);
            return null;
        }
        if (typeof exported !== 'function' || !exported.prototype) {
            RUN.fail(`${mod.main}: module.exports is no class`);
            return null;
        }
        return exported;
    }

    // What a lifecycle's handles register, each once and only while its start runs, by the handle each is on: each as
    // `<handle>.<name>.register()`, the runner's own `exports` on the handle named `handle`, `register(interface,
    // exports)` once for the run for each interface the manifest provides, and `register(exports)` once for the run for
    // the mods that depend on it by id, under its own id, beside the lifecycle's.
    function registryOf(lifecycle, { handle, joined }) {
        const registered = {};
        const exported = {}; // name, an interface or the mod's own id -> the exports registered for it
        let open = true;
        const closed = (name) => `${name} is called in ${lifecycle.method}(), and ${lifecycle.method}() has ended`;
        const once = (name, label, problemOf) => (value) => {
            if (!open) return RUN.fail(closed(label));
            if (Object.hasOwn(registered, name)) return RUN.fail(`${label} is called once`);
            const problem = problemOf(value);
            if (problem) return RUN.fail(`${label} ${problem}`);
            registered[name] = value;
        };
        const exportsProblem = (named, value) => {
            const own = named === RUN.mod.id;
            if (!own && (typeof named !== 'string' || !Object.hasOwn(RUN.mod.provides ?? {}, named)))
                return `takes an interface the manifest provides, and ${String(named)} is not one`;
            const what = own ? 'its own id' : named;
            if (Object.hasOwn(exported, named)) return `is called once for each name, and ${what} has its exports`;
            if (Object.hasOwn(joined.exportedIn, named))
                return `is called once for the run for each name, and a lifecycle under it opened ${what}`;
            if (!value || typeof value.connect !== 'function') return 'takes { connect(connection), disconnect? }';
            if (value.disconnect !== undefined && typeof value.disconnect !== 'function')
                return 'takes a disconnect function';
            return '';
        };
        const handles = {};
        const registers = (on, name, problemOf) =>
            ((handles[on] ??= {})[name] = Object.freeze({
                register: once(name, `${on}.${name}.register()`, problemOf),
            }));
        for (const [name, { handle: on, check }] of Object.entries(lifecycle.registrations || {}))
            registers(on, name, check);
        const label = `${handle}.exports.register()`;
        (handles[handle] ??= {}).exports = Object.freeze({
            register: (...given) => {
                if (!open) return RUN.fail(closed(label));
                const [named, value] = given.length === 1 ? [RUN.mod.id, given[0]] : given;
                const problem = exportsProblem(named, value);
                if (problem) return RUN.fail(`${label} ${problem}`);
                exported[named] = value;
            },
        });
        return {
            handles,
            // What it registered, by name, `exports` by interface or the mod's own id.
            close() {
                open = false;
                return Object.keys(exported).length ? { ...registered, exports: { ...exported } } : { ...registered };
            },
        };
    }

    // The runner's members on a lifecycle's handle, what they make cut with `scope`: `dependencies` is what the
    // lifecycle was connected to as it began.
    function membersOf({ given, scope, dependencies }) {
        const { mod } = RUN;
        return {
            id: mod.id,
            name: mod.name,
            storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records() }),
            dependencies,
            quit: RUN.quit,
            ...EVENT.forScope({ handle: given.handle, scope }),
            mods: MODS.tool(given.mods, scope),
        };
    }

    return { start };
}
