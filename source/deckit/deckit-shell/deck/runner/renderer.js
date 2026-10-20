import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as SETTINGS from '../setting/renderer.js';
import * as EVENT from '../event/renderer.js';
import * as ENTRY from '../mod/entry.js';
import * as SCOPED from '../mod/model/scoped-name.js';
import * as MOD_PERMISSION from '../mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The run of a mod in its page: its entry evaluated and started with the deck it is handed, and what it contributed
// told to main. `RUN` is the page's run; `STORAGE`, `EXPORT`, `EXTENSION` and `MODS` are what deck gives it; `modules`
// is the environment's (environment/: PAGE.modules).
export function createRunner({ RUN, STORAGE, EXPORT, EXTENSION, MODS, modules: MODULES }) {
    // MARK: - Property
    // What is on deck gives a mod when nothing is: nothing.
    const NOTHING = Object.freeze({
        members: [],
        deck: {},
        registrations: {},
        mods: {},
        contribute: () => ({}),
    });

    // MARK: - Initializer
    // MARK: - Public
    // The mod this page runs, started and contributed. `layer(context)` is what is on deck, asked with the mod
    // (`{ mod, run, deliver, fail }`) before its entry runs, and answers what it gives the mod: `members`, what it
    // reads of the entry besides deck; `deck`, the members it adds to deck; `registrations`, the ones it adds,
    // each by its check; `mods`, what it adds to deck.mods; and `contribute(parts, entry)`, called with all start()
    // registered once it has ended, which answers what main is told of the mod beside deck's own: `summary` and
    // `contributions`, which deck carries and does not read. Deck's own members and registrations are never the
    // layer's.
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
        // Answered from the first, so a page whose mod never started does not keep main waiting. stop() runs
        // once, after a start() still going has ended; a mod asked to stop before its start() is not started.
        let startedEntry = null; // the entry, once its start() is called
        let starting = null;
        let stopping = null;
        PROTOCOL.stop.handle(
            () =>
                (stopping ??= (async () => {
                    await starting?.catch(() => {});
                    if (typeof startedEntry?.stop === 'function') await stopOf(startedEntry);
                })())
        );
        const loaded = PROTOCOL.load.invoke();
        RUN.begin(loaded);
        const mod = RUN.mod;
        const { deliver, fail } = RUN;
        const given = layer ? { ...NOTHING, ...layer({ mod, run: RUN.number, deliver, fail }) } : NOTHING;
        const entry = evaluate(loaded.source, given.members);
        if (!entry) return RUN.notStarted();
        // Declared before anything waits, so a setting is there to set from start(); what is asked of the mod's
        // settings by another mod waits for its deck.
        let made = null;
        const deckMade = new Promise((resolve, reject) => (made = { resolve, reject }));
        deckMade.catch(() => {});
        const settings = SETTINGS.of({
            declared: entry.settings || {},
            saved: loaded.settings,
            deck: deckMade,
            deliver,
            fail,
        });
        SETTINGS.declare(RUN.number, entry.settings, fail);
        const optional = EXPORT.optionalOf();
        const requires = await EXPORT.requiresOf(optional);
        if (!requires) {
            made.reject(new Error(`${mod.id} did not start`));
            return RUN.notStarted();
        }
        if (stopping) return;
        const registry = registryOf(given.registrations);
        const deck = deckOf({
            given,
            settings,
            requires,
            optional: optional.handles,
            register: registry.register,
            extensionPoint: registry.extensionPoint,
        });
        made.resolve(deck);
        // Whatever start() did, stop() is told: when the run terminates, or once start() has failed.
        startedEntry = entry;
        starting = (async () => entry.start(deck))();
        try {
            await starting;
        } catch (error) {
            registry.close();
            fail(`start() threw: ${error.message || error}`);
            return RUN.notStarted();
        }
        const parts = registry.close();
        if (stopping) return;
        let contributions;
        let reported;
        try {
            contributions = contributionsOf(parts);
            reported = given.contribute(parts, entry) || {};
        } catch (error) {
            fail(error.message || String(error));
            return RUN.notStarted();
        }
        EXPORT.answer(parts.exports);
        EXTENSION.answer(parts.extend, parts.points);
        PROTOCOL.started.send({
            run: RUN.number,
            contributions: { ...reported.contributions, ...contributions },
            summary: {
                ...reported.summary,
                exports: !!parts.exports,
                extensionPoints: contributions.extensionPoints,
                requires: Object.keys(mod.requires),
            },
        });
    }

    // A stop() that throws is recorded like any call into the mod; the run ends either way.
    async function stopOf(entry) {
        try {
            await entry.stop();
        } catch (error) {
            RUN.fail(`stop() threw: ${error.message || error}`);
        }
    }

    // The entry runs as a CommonJS module with nothing else in reach, and is what it sets module.exports to. Who
    // the mod is comes from its manifest; `members` is what is on deck reads of it besides.
    function evaluate(source, members) {
        const { mod } = RUN;
        let exported = null;
        try {
            exported = MODULES.evaluate(source, { mod: mod.id, file: mod.main });
        } catch (error) {
            RUN.fail(`${mod.main} failed to load: ${error.message || error}`);
            return null;
        }
        const problem = ENTRY.problemOf(exported, members);
        if (problem) {
            RUN.fail(`${mod.main}: ${problem}`);
            return null;
        }
        return exported;
    }

    // What start() registers, each once and only while it runs: deck contributes it all when start() ends, and
    // hands what is on deck what was registered. An extension point is opened once by its name.
    function registryOf(added) {
        const registered = {};
        const points = new Map(); // a point's name -> its handle's own side
        let open = true;
        const once = (name, problemOf) => (value) => {
            if (!open) return RUN.fail(`deck.${name}() is called in start(), and start() has ended`);
            if (Object.hasOwn(registered, name)) return RUN.fail(`deck.${name}() is called once`);
            const problem = problemOf(value);
            if (problem) return RUN.fail(`deck.${name}() ${problem}`);
            registered[name] = value;
        };
        const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
        const extensions = (value) => {
            if (!value || typeof value !== 'object') return 'takes { "<mod id>:<point>": extension }';
            const wrong = Object.entries(value).find(
                ([point, extension]) => !SCOPED.isScoped(point) || !extension || typeof extension !== 'object'
            );
            return wrong ? `takes { "<mod id>:<point>": extension }, not "${wrong[0]}"` : '';
        };
        return {
            register: {
                ...Object.fromEntries(Object.entries(added).map(([name, check]) => [name, once(name, check)])),
                exports: once('exports', table),
                extend: once('extend', extensions),
            },
            // A call it refuses is shown on the mod's row like any registration's, and answers a point nothing
            // extends.
            extensionPoint(asked) {
                const name = String(asked);
                if (!open) RUN.fail('deck.extensionPoint() is called in start(), and start() has ended');
                else if (!name) RUN.fail('deck.extensionPoint() takes a name');
                else if (points.has(name)) RUN.fail(`deck.extensionPoint("${name}") is called once`);
                else {
                    points.set(name, EXTENSION.pointOf(name));
                    return points.get(name).handle;
                }
                return EXTENSION.pointOf(name).handle;
            },
            // What it registered, by kind, and the points it opens.
            close() {
                open = false;
                return { ...registered, points };
            },
        };
    }

    function deckOf({ given, settings, requires, optional, register, extensionPoint }) {
        const { mod } = RUN;
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        return Object.freeze({
            ...given.deck,
            id: mod.id,
            name: mod.name,
            settings,
            storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(RUN.fail) }),
            requires,
            optional,
            caller: EXPORT.callerNow,
            ...register,
            extensionPoint,
            ...EVENT.forMod({ owner: { deliver: RUN.deliver, recordFailure: RUN.fail }, run: RUN.number }),
            ...(has(MOD_PERMISSION.MODS) ? { mods: MODS.tool(given.mods) } : {}),
            ...(has(MOD_PERMISSION.MOD_SETTINGS) ? { modSettings: SETTINGS.modSettingsTool() } : {}),
        });
    }

    // What deck joins of what start() registered: exports and each extension as its values copied as JSON text and the
    // paths of its functions, and the points it opens by name.
    function contributionsOf(parts) {
        const copy = (what, value) => {
            try {
                return snapshotOf(value);
            } catch (error) {
                throw new Error(`${what} takes values that can be copied as JSON: ${error.message || error}`);
            }
        };
        return {
            exports: copy('deck.exports()', parts.exports || {}),
            extensionPoints: [...parts.points.keys()],
            extensions: Object.fromEntries(
                Object.entries(parts.extend || {}).map(([point, extension]) => [
                    point,
                    copy('deck.extend()', extension),
                ])
            ),
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
