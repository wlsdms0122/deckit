DeckitModule.define(
    'deck/service/deck/page',
    {
        uses: [
            'deck/service/log/page',
            'deck/service/event/page',
            'deck/service/deck/page-storage',
            'deck/service/deck/page-settings',
            'deck/service/deck/protocol',
            'deck/service/deck/model/origin',
            'deck/service/deck/model/extension-point',
            'deck/service/deck/model/proxy',
            'deck/service/mod/entry',
        ],
        provides: ['start'],
        runs: 'page',
    },
    (LOG, EVENT, STORAGE, SETTINGS, PROTOCOL, ORIGIN, EXTENSION_POINT, PROXY, ENTRY) => {
        // MARK: - Property
        // What is on deck gives a mod when nothing is: nothing.
        const NOTHING = Object.freeze({
            members: [],
            deck: {},
            registrations: {},
            mods: {},
            contribute: () => ({}),
        });
        const failures = [];
        let mod = null;
        let runNumber = null; // which run of the mod main counts this one as

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
                fail(`deckit could not start it: ${error.message || error}`);
                notStarted();
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
            mod = loaded.manifest;
            runNumber = loaded.run;
            const given = layer ? { ...NOTHING, ...layer({ mod, run: runNumber, deliver, fail }) } : NOTHING;
            const entry = evaluate(loaded.source, given.members);
            if (!entry) return notStarted();
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
            PROTOCOL.declare.send({ run: runNumber, settings: SETTINGS.declarationsOf(entry.settings, fail) });
            const requires = await requirementsOf();
            if (!requires) {
                made.reject(new Error(`${mod.id} did not start`));
                return notStarted();
            }
            if (stopping) return;
            const registry = registryOf(given.registrations);
            const deck = deckOf({
                given,
                settings,
                requires,
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
                return notStarted();
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
                return notStarted();
            }
            contribute(parts, { contributions, reported });
        }

        // A stop() that throws is recorded like any call into the mod; the run ends either way.
        async function stopOf(entry) {
            try {
                await entry.stop();
            } catch (error) {
                fail(`stop() threw: ${error.message || error}`);
            }
        }

        // It did not start, and why: what the mods that require it are told.
        function notStarted() {
            PROTOCOL.notStarted.send({ run: runNumber, problem: String(failures.at(-1) || 'it did not start') });
        }

        // A throw, or a promise that rejects, is recorded against the mod, never only a console line.
        function deliver(what, listener, ...args) {
            try {
                Promise.resolve(listener(...args)).catch((error) => fail(`${what} threw: ${error.message || error}`));
            } catch (error) {
                fail(`${what} threw: ${error.message || error}`);
            }
        }

        function fail(problem) {
            LOG.warn(`${mod?.id ?? 'a mod'}: ${problem}`);
            failures.push(problem);
            PROTOCOL.problem.send({ run: runNumber, problem: String(problem) });
        }

        // The entry runs as a CommonJS module with nothing else in reach, and is what it sets module.exports to. Who
        // the mod is comes from its manifest; `members` is what is on deck reads of it besides.
        function evaluate(source, members) {
            const module = { exports: {} };
            try {
                new Function(
                    'module',
                    'exports',
                    `${source}\n//# sourceURL=${ORIGIN.SCHEME.scheme}://${mod.id}/${mod.main}`
                )(module, module.exports);
            } catch (error) {
                fail(`${mod.main} failed to load: ${error.message || error}`);
                return null;
            }
            const problem = ENTRY.problemOf(module.exports, members);
            if (problem) {
                fail(`${mod.main}: ${problem}`);
                return null;
            }
            return module.exports;
        }

        // What each mod it requires exports: values copied and frozen, functions called through main.
        async function requirementsOf() {
            const given = await PROTOCOL.requirements.invoke();
            const out = {};
            for (const [id, exported] of Object.entries(given)) {
                if (exported.error) {
                    fail(exported.error);
                    return null;
                }
                out[id] = PROXY.deepFreeze(
                    PROXY.proxyOf(exported.functions, structuredClone(exported.values), (path, args) =>
                        PROTOCOL.callExport.invoke({ run: runNumber, mod: id, path, args })
                    )
                );
            }
            return Object.freeze(out);
        }

        // What start() registers, each once and only while it runs: deck contributes it all when start() ends, and
        // hands what is on deck what was registered. An extension point is opened once by its name.
        function registryOf(added) {
            const registered = {};
            const points = new Map(); // a point's name -> its handle's own side
            let open = true;
            const once = (name, problemOf) => (value) => {
                if (!open) return fail(`deck.${name}() is called in start(), and start() has ended`);
                if (Object.hasOwn(registered, name)) return fail(`deck.${name}() is called once`);
                const problem = problemOf(value);
                if (problem) return fail(`deck.${name}() ${problem}`);
                registered[name] = value;
            };
            const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
            const extensions = (value) => {
                if (!value || typeof value !== 'object') return 'takes { "<mod id>:<point>": extension }';
                const wrong = Object.entries(value).find(
                    ([point, extension]) => !EXTENSION_POINT.isId(point) || !extension || typeof extension !== 'object'
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
                    if (!open) fail('deck.extensionPoint() is called in start(), and start() has ended');
                    else if (!name) fail('deck.extensionPoint() takes a name');
                    else if (points.has(name)) fail(`deck.extensionPoint("${name}") is called once`);
                    else {
                        points.set(name, extensionPointOf(name));
                        return points.get(name).handle;
                    }
                    return extensionPointOf(name).handle;
                },
                // What it registered, by kind, and the points it opens.
                close() {
                    open = false;
                    return { ...registered, points };
                },
            };
        }

        function deckOf({ given, settings, requires, register, extensionPoint }) {
            const has = (permission) => mod.permissions.some(({ id }) => id === permission);
            return Object.freeze({
                ...given.deck,
                id: mod.id,
                name: mod.name,
                settings,
                storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(fail) }),
                requires,
                ...register,
                extensionPoint,
                ...EVENT.forMod({ owner: { deliver, recordFailure: fail } }),
                ...(has('deckit.mods') ? { mods: modsTool(given.mods) } : {}),
                ...(has('deckit.mod-settings') ? { modSettings: modSettingsTool() } : {}),
            });
        }

        // `added` is what is on deck adds.
        function modsTool(added) {
            return Object.freeze({
                ...added,
                list: () => PROTOCOL.mods.invoke(),
                pick: () => PROTOCOL.pick.invoke(),
                install: (from) => PROTOCOL.install.invoke({ from: String(from) }),
                remove: (id, data) => PROTOCOL.remove.invoke({ id: String(id), data: !!data }),
                relaunch: (id) => PROTOCOL.relaunch.invoke({ id: String(id) }),
                reveal: (id) => PROTOCOL.reveal.invoke({ id: String(id) }),
                count: (id) => PROTOCOL.count.invoke({ id: String(id) }),
            });
        }

        function modSettingsTool() {
            return Object.freeze({
                list: () => PROTOCOL.modSettings.invoke(),
                set: (id, key, value) => PROTOCOL.setModSetting.invoke({ mod: id, key, value }),
                run: (id, key) => PROTOCOL.runModSetting.invoke({ mod: id, key }),
            });
        }

        // One of the mod's extension points. `extensions()` is what extends it now, by the id of the mod that extends
        // it, each one's functions called through main; `onChange(listener)` hears what it is each time it changes, and
        // answers its off. Nothing extends it before start() has ended: a mod that does requires this one.
        function extensionPointOf(name) {
            const point = EXTENSION_POINT.idOf(mod.id, name);
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
                                    PROXY.proxyOf(functions, values, (path, args) =>
                                        PROTOCOL.callExtension.invoke({ run: runNumber, mod: id, point, path, args })
                                    )
                                ),
                            ])
                        )
                    );
                    for (const listener of listeners) deliver('onChange()', listener, extensions);
                },
            };
        }

        // What deck joins of what start() registered: exports and each extension as its values copied and the paths of
        // its functions, and the points it opens by name.
        function contributionsOf(parts) {
            const copy = (what, value) => {
                try {
                    return structuredClone(snapshotOf(value));
                } catch (error) {
                    throw new Error(`${what} takes values that can be copied: ${error.message || error}`);
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

        // `reported` is what is on deck tells main of the mod, under deck's own: deck carries it and does not read it.
        function contribute(parts, { contributions, reported }) {
            PROTOCOL.exportCalled.handle(({ path, args }) => {
                const exported = path.reduce((at, key) => at?.[key], parts.exports);
                if (typeof exported !== 'function') throw new Error(`${mod.id} exports no function ${path.join('.')}`);
                return exported(...args);
            });
            PROTOCOL.extensionCalled.handle(({ point, path, args }) => {
                const extension = path.reduce((at, key) => at?.[key], parts.extend?.[point]);
                if (typeof extension !== 'function')
                    throw new Error(`${mod.id} extends ${point} with no function ${path.join('.')}`);
                return extension(...args);
            });
            PROTOCOL.extensionsChanged.on(({ name, extensions }) => parts.points.get(name)?.set(extensions));
            PROTOCOL.started.send({
                run: runNumber,
                contributions: { ...reported.contributions, ...contributions },
                summary: {
                    ...reported.summary,
                    exports: !!parts.exports,
                    extensionPoints: contributions.extensionPoints,
                    requires: Object.keys(mod.requires),
                },
            });
        }

        // Values as data, functions as the paths main calls them by. An object inside itself has no path to end.
        function snapshotOf(given) {
            const functions = [];
            const walk = (value, path, holding) => {
                if (typeof value === 'function') {
                    functions.push(path);
                    return undefined;
                }
                if (!value || typeof value !== 'object') return value;
                if (holding.includes(value)) throw new Error(`${path.join('.') || 'it'} holds itself`);
                const out = Array.isArray(value) ? [] : {};
                for (const [key, inner] of Object.entries(value)) {
                    const copied = walk(inner, [...path, key], [...holding, value]);
                    if (copied !== undefined) out[key] = copied;
                }
                return out;
            };
            return { values: walk(given, [], []), functions };
        }

        return { start };
    }
);
