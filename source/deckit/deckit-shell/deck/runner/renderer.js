import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';
import * as MOD_PERMISSION from '../mod/permission.js';
import * as LIMIT from './model/limit.js';
import { makeScope } from './model/scope.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The run of a mod in its page: its entry evaluated, the class it exports made once and its lifecycles started in the
// order they are stacked, and what each registered told to main as it joins. `RUN` is the page's run; `STORAGE`,
// `EXPORT`, `EXTENSION`, `EVENT` and `MODS` are what deck gives it; `modules` is the environment's (environment/:
// PAGE.modules).
export function createRunner({ RUN, STORAGE, EXPORT, EXTENSION, EVENT, MODS, modules: MODULES }) {
    // MARK: - Property
    // What is on deck when nothing is: no lifecycle, so the run starts once its class is made.
    const NOTHING = Object.freeze({ handle: 'deck', read: () => ({}), mods: {}, lifecycles: [] });

    // MARK: - Initializer
    // MARK: - Public
    // The mod this page runs. `layer(context)` is what is on deck, asked with the mod (`{ mod, run, deliver, fail }`)
    // before its entry runs, and answers:
    // `handle`, the name of the handle deck's members are on;
    // `read(Entry)`, what it reads of the class the entry exports, before any instance is made, as part of the
    // summary;
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
        const requires = await EXPORT.requiresOf();
        if (!requires) return RUN.notStarted();
        if (stopping) return;
        try {
            instance = new Entry();
        } catch (error) {
            fail(`its constructor threw: ${error.message || error}`);
            return RUN.notStarted();
        }
        // What deck joins of every lifecycle so far. A run with no lifecycle starts once its class is made.
        const joined = { exported: false, exports: snapshotOf({}), points: new Map(), extensions: {} };
        if (!given.lifecycles.length) {
            EXPORT.answer({});
            return tell(PROTOCOL.started, { described, joined, reported: {} });
        }
        for (const [index, lifecycle] of given.lifecycles.entries()) {
            const first = index === 0;
            const scope = makeScope();
            const registry = registryOf(lifecycle, { first, scope, handle: given.handle });
            const entry = { lifecycle, scope, registry };
            begun.push(entry);
            const { handles } = registry;
            handles[given.handle] = { ...deckOf({ given, scope, requires }), ...handles[given.handle] };
            let reported;
            try {
                await lifecycle.start(instance, handles, scope);
                if (stopping) return;
                const parts = registry.close();
                const { added, ...own } = ownOf(parts, joined, { first, handle: given.handle });
                reported = lifecycle.join(parts, scope) || {};
                Object.assign(joined, own);
                if (first) EXPORT.answer(parts.exports);
                scope.add(EXTENSION.join(added.extensions, added.points));
            } catch (error) {
                registry.close();
                fail(error.message || String(error));
                if (first) return RUN.notStarted();
                // Only that lifecycle ends: the run goes on with those under it, and none stacks on it.
                begun.pop();
                return end(entry, instance);
            }
            tell(first ? PROTOCOL.started : PROTOCOL.joined, { described, joined, reported });
        }
    }

    // Main is told what the run contributes now, all of it, and as a person reads it.
    function tell(channel, { described, joined, reported }) {
        const extensionPoints = [...joined.points.keys()];
        channel.send({
            run: RUN.number,
            contributions: {
                ...reported.contributions,
                exports: joined.exports,
                extensionPoints,
                extensions: joined.extensions,
            },
            summary: {
                ...described,
                ...reported.summary,
                exports: joined.exported,
                extensionPoints,
                requires: Object.keys(RUN.mod.requires),
            },
        });
    }

    // A lifecycle ends within its own limit, whatever its end throws, and what its handles made is cut once its end
    // has run or its time ran out.
    async function end({ lifecycle, scope, registry }, instance) {
        registry.close();
        let timer = null;
        const ran = (async () => lifecycle.end(instance))().catch((error) => RUN.fail(error.message || String(error)));
        const late = new Promise((resolve) => (timer = setTimeout(resolve, LIMIT.END_LIMIT_MS)));
        await Promise.race([ran, late]);
        clearTimeout(timer);
        scope.cut();
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

    // What a lifecycle's handles register, each once and only while its start runs, by the handle each is on:
    // deck's own, `exports` on the first lifecycle's only, `extends` and `extensionPoint`, on the handle named
    // `handle`, beside the lifecycle's. An extension point is opened once by its name, and the points of each mod in
    // [extends] are extended once, by `<handle>.extends[id]`.
    function registryOf(lifecycle, { first, scope, handle }) {
        const registered = {};
        const points = new Map(); // a point's name -> its handle's own side
        const extensions = {}; // "<mod id>:<point>" -> the extension
        const extended = new Set(); // the ids whose points it extended
        let open = true;
        const closed = (name) => `${name} is called in ${lifecycle.method}(), and ${lifecycle.method}() has ended`;
        const once = (name, label, problemOf) => (value) => {
            if (!open) return RUN.fail(closed(label));
            if (Object.hasOwn(registered, name)) return RUN.fail(`${label} is called once`);
            const problem = problemOf(value);
            if (problem) return RUN.fail(`${label} ${problem}`);
            registered[name] = value;
        };
        const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
        const extend = (id) => (value) => {
            const name = `${handle}.extends.${id}()`;
            if (!open) return RUN.fail(closed(name));
            if (extended.has(id)) return RUN.fail(`${name} is called once`);
            const wrong =
                !value || typeof value !== 'object'
                    ? ['']
                    : Object.entries(value).find(
                          ([point, extension]) => !point || !extension || typeof extension !== 'object'
                      );
            if (wrong) return RUN.fail(`${name} takes { <point>: extension }${wrong[0] ? `, not "${wrong[0]}"` : ''}`);
            extended.add(id);
            for (const [point, extension] of Object.entries(value))
                extensions[SCOPED.scopedName(id, point)] = extension;
        };
        const handles = {};
        for (const [name, { handle: on, check }] of Object.entries(lifecycle.registrations || {}))
            (handles[on] ??= {})[name] = once(name, `${on}.${name}()`, check);
        handles[handle] = {
            ...handles[handle],
            ...(first ? { exports: once('exports', `${handle}.exports()`, table) } : {}),
            // Every id, so the core says why of one not in [extends].
            extends: new Proxy(Object.freeze({}), {
                get: (_, id) => (typeof id === 'string' ? extend(id) : undefined),
            }),
            // A call it refuses is shown on the mod's row like any registration's, and answers a point nothing
            // extends.
            extensionPoint(asked) {
                const name = String(asked);
                const label = `${handle}.extensionPoint()`;
                if (!open) RUN.fail(closed(label));
                else if (!name) RUN.fail(`${label} takes a name`);
                else if (points.has(name)) RUN.fail(`${handle}.extensionPoint("${name}") is called once`);
                else {
                    points.set(name, EXTENSION.pointOf(name, scope));
                    return points.get(name).handle;
                }
                return EXTENSION.pointOf(name, scope).handle;
            },
        };
        return {
            handles,
            // What it registered, by name, the points it opens and what it extends.
            close() {
                open = false;
                return { ...registered, points, extensions };
            },
        };
    }

    // Deck's members on a lifecycle's handle, what they make cut with `scope`.
    function deckOf({ given, scope, requires }) {
        const { mod } = RUN;
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        return {
            id: mod.id,
            name: mod.name,
            storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(RUN.fail) }),
            requires,
            caller: EXPORT.callerNow,
            ...EVENT.forScope({ handle: given.handle, scope }),
            ...(has(MOD_PERMISSION.MODS) ? { mods: MODS.tool(given.mods, scope) } : {}),
        };
    }

    // What deck joins of what a lifecycle registered, over what it joined of those under it: exports, the first
    // lifecycle's, its values copied as JSON text and the paths of its functions; the points it opens; each extension,
    // copied as exports are. A point or an extension a lifecycle under it has already is that one's, and this
    // lifecycle's is left out. Answers it all so far, and `added`, this lifecycle's own.
    function ownOf(parts, joined, { first, handle }) {
        const copy = (what, value) => {
            try {
                return snapshotOf(value);
            } catch (error) {
                throw new Error(`${what} takes values that can be copied as JSON: ${error.message || error}`);
            }
        };
        const points = new Map();
        for (const [name, point] of parts.points) {
            if (joined.points.has(name))
                RUN.fail(`extension point "${name}" is opened under it, so this one is left out`);
            else points.set(name, point);
        }
        const extensions = {};
        for (const [point, extension] of Object.entries(parts.extensions)) {
            if (Object.hasOwn(joined.extensions, point)) RUN.fail(`${point} is extended under it, so this is left out`);
            else extensions[point] = extension;
        }
        const copied = Object.fromEntries(
            Object.entries(extensions).map(([point, extension]) => [
                point,
                copy(`${handle}.extends.${SCOPED.modOf(point)}()`, extension),
            ])
        );
        return {
            exported: first ? !!parts.exports : joined.exported,
            exports: first ? copy(`${handle}.exports()`, parts.exports || {}) : joined.exports,
            points: new Map([...joined.points, ...points]),
            extensions: { ...joined.extensions, ...copied },
            added: { points, extensions },
        };
    }

    // Values as JSON text, functions as the paths main calls them by. An object inside itself has no path to end.
    function snapshotOf(given) {
        const functions = [];
        const walk = (value, path, holding) => {
            if (typeof value === 'function') {
                functions.push(path);
                return undefined;
            }
            if (
                typeof value === 'bigint' ||
                typeof value === 'symbol' ||
                (typeof value === 'number' && !Number.isFinite(value))
            )
                throw new Error(`${path.join('.') || 'it'} is ${String(value)}, which JSON does not hold`);
            if (!value || typeof value !== 'object') return value;
            if (holding.includes(value)) throw new Error(`${path.join('.') || 'it'} holds itself`);
            const out = Array.isArray(value) ? [] : {};
            for (const [key, inner] of Object.entries(value)) {
                const copied = walk(inner, [...path, key], [...holding, value]);
                if (copied !== undefined) out[key] = copied;
            }
            return out;
        };
        return { values: JSON.stringify(walk(given, [], []) ?? null), functions };
    }

    return { start };
}
