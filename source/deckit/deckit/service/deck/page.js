DeckitModule.define(
    'deckit/service/deck/page',
    {
        uses: [
            'deckit/config',
            'deckit/service/log/page',
            'deckit/module/match',
            'deckit/module/ranker',
            'deckit/service/web/page',
            'deckit/service/notify/page',
            'deckit/service/clipboard/page',
            'deckit/service/runtime/page',
            'deckit/service/open/page',
            'deckit/service/keymap/page',
            'deckit/service/switcher/page',
            'deckit/service/event/page',
            'deckit/service/style/page',
            'deckit/module/event-bus',
            'deckit/service/deck/page-storage',
            'deckit/service/deck/page-settings',
            'deckit/service/deck/protocol',
            'deckit/service/deck/model/origin',
            'deckit/service/deck/model/extension-point',
            'deckit/service/mod/entry',
            'deckit/service/keymap/model/binding-id',
            'host/exports?',
        ],
        provides: ['start'],
        runs: 'page',
    },
    (
        CONFIG,
        LOG,
        MATCH,
        RANKER,
        WEB,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        OPEN,
        KEYMAP,
        SWITCHER,
        EVENT,
        MOD_STYLE,
        EVENT_BUS,
        STORAGE,
        SETTINGS,
        PROTOCOL,
        ORIGIN,
        EXTENSION_POINT,
        ENTRY,
        BINDING_ID,
        HOST
    ) => {
        // MARK: - Property
        const failures = [];
        let mod = null;
        let runNumber = null; // which run of the mod main counts this one as

        // MARK: - Initializer
        // MARK: - Public
        // The mod this page runs, started and contributed. `show` puts it on screen and `dismiss` puts the panel
        // away; `layers` is what floats in the page. Resolves { mod, entry, parts, tell }, parts null when it
        // did not start; `tell(name)` calls one of its view's parts (didAppear, didDisappear) the way every call into
        // it is made.
        async function start(options) {
            try {
                return await run(options);
            } catch (error) {
                fail(`deckit could not start it: ${error.message || error}`);
                return notStarted(null);
            }
        }

        // MARK: - Private
        async function run({ theme, ui, layers, show, dismiss }) {
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
            WEB.listen();
            NOTIFY.listen(deliver);
            MOD_STYLE.wear();
            const entry = evaluate(loaded.source);
            if (!entry) return notStarted(null);
            // Declared before anything waits, so a setting is there to set from start(); what Settings asks of the
            // mod waits for its deck.
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
                return notStarted(entry);
            }
            if (stopping) return notContributed(entry);
            const registry = registryOf();
            const deck = deckOf({
                theme,
                ui,
                settings,
                requires,
                show,
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
                return notStarted(entry);
            }
            const parts = registry.close();
            if (stopping) return notContributed(entry);
            let contributions;
            try {
                contributions = contributionsOf(parts);
            } catch (error) {
                fail(error.message);
                return notStarted(entry);
            }
            contribute(entry, parts, { contributions, layers, dismiss });
            const tell = (name) => typeof parts[name] === 'function' && deliver(`${name}()`, () => parts[name]());
            return { mod, entry, parts, tell };
        }

        // Its run terminated before it started: nothing it registered is contributed.
        function notContributed(entry) {
            return { mod, entry, parts: null, tell: () => {} };
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
        function notStarted(entry) {
            PROTOCOL.notStarted.send({ run: runNumber, problem: String(failures.at(-1) || 'it did not start') });
            return { mod, entry, parts: null, tell: () => {} };
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
        // the mod is comes from its manifest.
        function evaluate(source) {
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
            const problem = ENTRY.problemOf(module.exports);
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
                out[id] = deepFreeze(
                    proxyOf(exported.functions, structuredClone(exported.values), (path, args) =>
                        PROTOCOL.callExport.invoke({ run: runNumber, mod: id, path, args })
                    )
                );
            }
            return Object.freeze(out);
        }

        // Values as given, with a function at each path that calls it by its path. A path names the object's own
        // properties, defined rather than assigned: a name such as `__proto__` is a property like any other, never
        // the page's prototypes.
        function proxyOf(functions, values, call) {
            const out = values && typeof values === 'object' ? values : {};
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

        // What start() registers, each once and only while it runs: deck contributes it all when start() ends. An
        // extension point is opened once by its name.
        function registryOf() {
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
            const fn = (value) => (typeof value === 'function' ? '' : 'takes a function');
            const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
            const view = (value) =>
                value?.content?.nodeType === Node.ELEMENT_NODE
                    ? ''
                    : 'takes { content, sidebar, didAppear, didDisappear }, content an element';
            const extensions = (value) => {
                if (!value || typeof value !== 'object') return 'takes { "<mod id>:<point>": extension }';
                const wrong = Object.entries(value).find(
                    ([point, extension]) => !EXTENSION_POINT.isId(point) || !extension || typeof extension !== 'object'
                );
                return wrong ? `takes { "<mod id>:<point>": extension }, not "${wrong[0]}"` : '';
            };
            const styles = (value) => {
                if (!value || typeof value !== 'object') return 'takes { "<mod id>" or "*": css }';
                const wrong = Object.entries(value).find(([, css]) => typeof css !== 'string');
                return wrong ? `takes css text for "${wrong[0]}"` : '';
            };
            return {
                register: {
                    view: once('view', view),
                    keys: once('keys', table),
                    commands: once('commands', fn),
                    now: once('now', fn),
                    resolve: once('resolve', fn),
                    handleURL: once('handleURL', fn),
                    exports: once('exports', table),
                    extend: once('extend', extensions),
                    styles: once('styles', styles),
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
                // The parts deck contributes: the view's, its keys, its switcher answers, its URL handler, its exports, what
                // it extends other mods' points with, its styles, and the points it opens.
                close() {
                    open = false;
                    const { view: shown = {}, ...rest } = registered;
                    return { ...rest, ...shown, points };
                },
            };
        }

        function deckOf({ theme, ui, settings, requires, show, register, extensionPoint }) {
            const { styles, ...registrations } = register;
            const has = (permission) => mod.permissions.some(({ id }) => id === permission);
            const opener = { open: (url, options) => OPEN.open(url, options) };
            return Object.freeze({
                id: mod.id,
                name: mod.name,
                theme,
                ui,
                settings,
                storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(fail) }),
                web: WEB.forMod({
                    modId: mod.id,
                    permissions: mod.permissions.map(({ id }) => id),
                    owner: { deliver, recordFailure: fail },
                    opener,
                }),
                requires,
                util: Object.freeze({ match: MATCH.match, ranker: RANKER.ranker, movePath, tildify: tildifyOf() }),
                ...registrations,
                extensionPoint,
                ...EVENT.forMod({ owner: { deliver, recordFailure: fail } }),
                show,
                open: (url, options) => OPEN.open(url, options),
                reveal: OPEN.reveal,
                fileURL: OPEN.fileURL,
                filePath: OPEN.filePath,
                about: RUNTIME.about,
                chordOf: (action) => KEYMAP.chord(BINDING_ID.idOf(mod.id, action)),
                clipboard: Object.freeze(
                    has('system.clipboard')
                        ? { readText: CLIPBOARD.readText, writeText: CLIPBOARD.writeText }
                        : { writeText: CLIPBOARD.writeText }
                ),
                ...(has('system.notifications') ? { notify: NOTIFY.notify } : {}),
                ...(has('system.main-process') ? { mainProcess: mainProcessOf() } : {}),
                ...(has('deckit.mods') ? { mods: modsTool() } : {}),
                ...(has('deckit.mod-settings') ? { modSettings: modSettingsTool() } : {}),
                ...(has('deckit.styles') ? { styles } : {}),
                ...(has('deckit.key-map')
                    ? {
                          keymap: Object.freeze({
                              list: KEYMAP.bindings,
                              set: KEYMAP.bind,
                              reset: KEYMAP.reset,
                              record: KEYMAP.record,
                              onChange: KEYMAP.onChange,
                          }),
                      }
                    : {}),
                ...(has('deckit.url-schemes')
                    ? {
                          urlSchemes: Object.freeze({
                              list: OPEN.handlerLists,
                              set: OPEN.setHandlers,
                              everyScheme: OPEN.EVERY,
                          }),
                      }
                    : {}),
                ...(mod.id === CONFIG.id && HOST ? { host: deepFreeze({ ...HOST }) } : {}),
            });
        }

        // deck.mainProcess(path): the module started once, its methods called through main, `on(name, listener)`
        // for what it emits. A start that failed is tried again the next time it is asked for.
        function mainProcessOf() {
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
            PROTOCOL.mainProcessEvent.on(({ path, name, args }) => busOf(path).emit(name, ...args));
            const moduleOf = ({ path, methods }) => {
                const proxy = proxyOf(methods, {}, (method, args) =>
                    PROTOCOL.callMainProcess.invoke({ path, method, args })
                );
                proxy.on = (name, listener) => busOf(path).on(name, listener);
                return deepFreeze(proxy);
            };
            return (path) => {
                const asked = String(path);
                if (!started.has(asked)) {
                    const starting = PROTOCOL.startMainProcess.invoke({ path: asked }).then(moduleOf);
                    starting.catch(() => started.get(asked) === starting && started.delete(asked));
                    started.set(asked, starting);
                }
                return started.get(asked);
            };
        }

        function modsTool() {
            return Object.freeze({
                list: () => PROTOCOL.mods.invoke(),
                pick: () => PROTOCOL.pick.invoke(),
                install: (from) => PROTOCOL.install.invoke({ from: String(from) }),
                remove: (id, data) => PROTOCOL.remove.invoke({ id: String(id), data: !!data }),
                relaunch: (id) => PROTOCOL.relaunch.invoke({ id: String(id) }),
                reveal: (id) => PROTOCOL.reveal.invoke({ id: String(id) }),
                count: (id) => PROTOCOL.count.invoke({ id: String(id) }),
                restartPending: () => PROTOCOL.restartPending.invoke(),
                restart: RUNTIME.restart,
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
                                deepFreeze(
                                    proxyOf(functions, values, (path, args) =>
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
        // its functions, the points it opens by name, its styles by what they style.
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
                styles: { ...(parts.styles || {}) },
            };
        }

        function contribute(entry, parts, { contributions, layers, dismiss }) {
            const names = mod.urlSchemes;
            const opens = typeof parts.handleURL === 'function';
            if (names.length && !opens)
                fail('manifest.toml names url-schemes, but start() registered no deck.handleURL()');
            if (opens && !names.length)
                fail('start() registered deck.handleURL(), but manifest.toml names no url-schemes, so nothing asks it');
            if (names.length && opens) OPEN.answer((url, options) => parts.handleURL(url, options));
            SWITCHER.source({
                icon: entry.icon,
                aliases: entry.keywords,
                open: !!parts.content,
                commands: guarded('commands', parts.commands),
                now: guarded('now', parts.now),
                resolve: typeof parts.resolve === 'function' ? (query) => parts.resolve(query) : null,
                invalid: fail,
            });
            KEYMAP.scope(parts.keys, {
                invalid: fail,
                global: mod.permissions.some(({ id }) => id === 'system.global-keys'),
                onScreen: !!parts.content,
            });
            KEYMAP.connect({ layers, deliver, dismiss });
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
                contributions,
                summary: {
                    icon: String(entry.icon || ''),
                    view: !!parts.content,
                    sidebar: !!parts.sidebar,
                    commands: typeof parts.commands === 'function',
                    now: typeof parts.now === 'function',
                    resolver: typeof parts.resolve === 'function',
                    urlSchemes: opens ? names : [],
                    exports: !!parts.exports,
                    extensionPoints: contributions.extensionPoints,
                    styles: Object.keys(contributions.styles),
                    requires: Object.keys(mod.requires),
                },
            });
        }

        // The one place a mod's function is called for a value. Asked again while still answering (its
        // commands() reading something that counts everyone's commands), it gets nothing instead of a loop.
        function guarded(name, ask) {
            if (typeof ask !== 'function') return null;
            let answering = false;
            return () => {
                if (answering) return undefined;
                answering = true;
                try {
                    return ask();
                } catch (error) {
                    fail(`${name}() threw: ${error.message || error}`);
                    return undefined;
                } finally {
                    answering = false;
                }
            };
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

        function deepFreeze(value) {
            if (value && typeof value === 'object' && !Object.isFrozen(value)) {
                Object.freeze(value);
                for (const inner of Object.values(value)) deepFreeze(inner);
            }
            return value;
        }

        // A path as it is shown: under the home folder, from `~`.
        function tildifyOf() {
            const { home } = RUNTIME.about();
            return (path) => (path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path);
        }

        // `to` null means gone: a path at or inside `from` becomes null. Paths are "/" separated.
        function movePath(path, from, to) {
            if (typeof path !== 'string' || (path !== from && !path.startsWith(from + '/'))) return path;
            return to == null ? null : to + path.slice(from.length);
        }

        return { start };
    }
);
