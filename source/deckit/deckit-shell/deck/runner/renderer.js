import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../mod/permission.js';
import * as LIMIT from './model/limit.js';
import { makeScope } from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The run of a mod in its page: its entry evaluated, the class it exports made once and its lifecycles started in the
// order they are stacked, each connected to the mods it depends on as it begins, and what each registered told to main
// as it joins. `RUN` is the page's run; `STORAGE`, `CONNECTION`, `EVENT` and `MODS` are what deck gives it; `modules`
// is the environment's (environment/: PAGE.modules).
export function createRunner({ RUN, STORAGE, CONNECTION, EVENT, MODS, modules: MODULES }) {
    // MARK: - Property
    // What is on deck when nothing is: no lifecycle, so the run starts once its class is made.
    const NOTHING = Object.freeze({ handle: 'deck', read: () => ({}), report: () => ({}), mods: {}, lifecycles: [] });

    // MARK: - Initializer
    // MARK: - Public
    // The mod this page runs. `layer(context)` is what is on deck, asked with the mod (`{ mod, run, deliver, fail }`)
    // before its entry runs, and answers:
    // `handle`, the name of the handle deck's members are on;
    // `read(Entry)`, what it reads of the class the entry exports, before any instance is made, as part of the
    // summary;
    // `report()`, what main is told of the run beside deck's own now, `{ summary, contributions }`, as `join` answers
    // it, once a lifecycle that did not start has ended;
    // `mods`, what it adds to `mods` for a mod with deckit.mods;
    // `lifecycles`, the lifecycles it stacks on the run, the lowest first. A lifecycle is `{ method, registrations,
    // start(instance, handles, scope), end(instance), join(parts, scope) }`: `method` names it in what a person reads;
    // `registrations`, by name, `{ handle, check }`, what the handles it hands out register beside deck's own;
    // `start`, which calls the instance with its handles, by name, each of deck's members and registrations on the
    // one named `handle`; `end`, which ends what start began; `join`, called with what it registered once start has
    // ended, which answers what main is told of the run beside deck's own, `{ summary, contributions }`, all of it
    // so far, which deck carries and does not read.
    // Each lifecycle has a `scope`: what its handles made that calls back into the mod's code is cut as it ends.
    async function start({ layer = null } = {}) {
        try {
            await run(layer);
        } catch (error) {
            RUN.fail(`deck could not start it: ${error.message || error}`);
            RUN.notStarted();
        }
    }

    // MARK: - Private
    async function run(layer) {
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
        const given = layer ? { ...NOTHING, ...layer({ mod, run: RUN.number, deliver, fail }) } : NOTHING;
        const Entry = evaluate(loaded.source);
        if (!Entry) return RUN.notStarted();
        let described;
        try {
            described = given.read(Entry);
        } catch (error) {
            fail(error.message || String(error));
            return RUN.notStarted();
        }
        PROTOCOL.described.send({ run: RUN.number, summary: described, lifecycles: given.lifecycles.length });
        if (stopping) return;
        try {
            instance = new Entry();
        } catch (error) {
            fail(`its constructor threw: ${error.message || error}`);
            return RUN.notStarted();
        }
        // The lifecycle that opened the run's exports, once one has, as deck joins it.
        const joined = { exportedIn: null };
        if (!given.lifecycles.length) return tell(PROTOCOL.started, { described, joined, reported: {} });
        // A required connection refused once its lifecycle has begun ends that lifecycle.
        CONNECTION.onRefused((index, problem) => {
            const entry = begun.find((one) => one.index === index);
            if (!entry || stopping) return;
            fail(problem);
            begun.splice(begun.indexOf(entry), 1);
            if (joined.exportedIn === index) joined.exportedIn = null;
            end(entry, instance).then(() => {
                if (!stopping) tell(PROTOCOL.joined, { described, joined, reported: given.report() });
            });
        });
        for (const [index, lifecycle] of given.lifecycles.entries()) {
            const first = index === 0;
            const scope = makeScope();
            const registry = registryOf(lifecycle, { handle: given.handle, joined });
            const entry = { index, lifecycle, scope, registry };
            begun.push(entry);
            const { handles } = registry;
            let reported;
            try {
                const { dependencies, problems } = await CONNECTION.begin(index, scope);
                for (const { required, problem } of problems) {
                    if (required) throw new Error(problem);
                    fail(problem);
                }
                handles[given.handle] = { ...deckOf({ given, scope, dependencies }), ...handles[given.handle] };
                await lifecycle.start(instance, handles, scope);
                if (stopping) return;
                const parts = registry.close();
                reported = lifecycle.join(parts, scope) || {};
                if (parts.exports) {
                    CONNECTION.give(index, parts.exports);
                    joined.exportedIn = index;
                }
            } catch (error) {
                registry.close();
                fail(error.message || String(error));
                if (first) return RUN.notStarted();
                // Only that lifecycle ends: the run goes on with those under it, and none stacks on it.
                begun.pop();
                await end(entry, instance);
                if (!stopping) tell(PROTOCOL.joined, { described, joined, reported: given.report() });
                return;
            }
            tell(first ? PROTOCOL.started : PROTOCOL.joined, { described, joined, reported });
        }
    }

    // Main is told what the run contributes now, all of it, and as a person reads it.
    function tell(channel, { described, joined, reported }) {
        const opened = joined.exportedIn === null ? {} : { exports: joined.exportedIn };
        channel.send({
            run: RUN.number,
            contributions: { ...reported.contributions, ...opened, awaits: CONNECTION.awaited() },
            summary: { ...described, ...reported.summary, exports: joined.exportedIn !== null },
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
            const late = new Promise((resolve) => (timer = setTimeout(resolve, LIMIT.END_LIMIT_MS)));
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
    // `<handle>.<name>.register()`, deck's own `exports` on the handle named `handle`, once for the run, beside the
    // lifecycle's.
    function registryOf(lifecycle, { handle, joined }) {
        const registered = {};
        let open = true;
        const closed = (name) => `${name} is called in ${lifecycle.method}(), and ${lifecycle.method}() has ended`;
        const once = (name, label, problemOf) => (value) => {
            if (!open) return RUN.fail(closed(label));
            if (Object.hasOwn(registered, name)) return RUN.fail(`${label} is called once`);
            const problem = problemOf(value);
            if (problem) return RUN.fail(`${label} ${problem}`);
            registered[name] = value;
        };
        const exportsProblem = (value) => {
            if (joined.exportedIn !== null) return 'is called once for the run, and a lifecycle under it opened them';
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
        registers(handle, 'exports', exportsProblem);
        return {
            handles,
            // What it registered, by name.
            close() {
                open = false;
                return { ...registered };
            },
        };
    }

    // Deck's members on a lifecycle's handle, what they make cut with `scope`: `dependencies` is what the lifecycle
    // was connected to as it began.
    function deckOf({ given, scope, dependencies }) {
        const { mod } = RUN;
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        return {
            id: mod.id,
            name: mod.name,
            storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(RUN.fail) }),
            dependencies,
            ...EVENT.forScope({ handle: given.handle, scope }),
            ...(has(MOD_PERMISSION.MODS) ? { mods: MODS.tool(given.mods, scope) } : {}),
        };
    }

    return { start };
}
