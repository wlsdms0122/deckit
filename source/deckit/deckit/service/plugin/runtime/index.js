DeckitModule.define(
    'deckit/service/plugin/runtime',
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
            'deckit/service/plugin/runtime/storage',
            'deckit/service/plugin/runtime/settings',
            'deckit/service/plugin/deck/protocol',
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
        STORAGE,
        SETTINGS,
        PROTOCOL,
        HOST
    ) => {
        // MARK: - Property
        const DEFINITION = new Set(['icon', 'keywords', 'settings', 'start', 'stop']);
        const failures = [];
        let plugin = null;
        let pageRun = null; // which run of this page main counts this one as

        // MARK: - Initializer
        // MARK: - Public
        // The plugin this page runs, started and contributed. `show` puts it on screen and `dismiss` puts the panel
        // away; `layers` is what floats in the page. Resolves { plugin, definition, parts, tell }, parts null when it
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
            // Answered from the first, so a page whose plugin never started does not keep main waiting; stop() runs
            // once.
            let started = null;
            let stopping = null;
            PROTOCOL.stop.handle(() => (stopping ??= typeof started?.stop === 'function' ? stopOf(started) : null));
            const loaded = PROTOCOL.load.invoke();
            plugin = loaded.manifest;
            pageRun = loaded.run;
            WEB.listen();
            NOTIFY.listen(deliver);
            const definition = evaluate(loaded.source);
            if (!definition) return notStarted(null);
            // Declared before anything waits, so a setting is there to set from start(); what Settings asks of the
            // plugin waits for its deck.
            let made = null;
            const deckMade = new Promise((resolve, reject) => (made = { resolve, reject }));
            deckMade.catch(() => {});
            const settings = SETTINGS.of({
                declared: definition.settings || {},
                saved: loaded.settings,
                deck: deckMade,
                deliver,
                fail,
            });
            PROTOCOL.declare.send({ run: pageRun, settings: SETTINGS.declarationsOf(definition.settings, fail) });
            const requires = await requirementsOf();
            if (!requires) {
                made.reject(new Error(`${plugin.id} did not start`));
                return notStarted(definition);
            }
            const registry = registryOf();
            const deck = deckOf({ theme, ui, settings, requires, show, register: registry.register });
            made.resolve(deck);
            // Whatever start() did before it ended, stop() is told when the sandbox ends.
            started = definition;
            try {
                await definition.start(deck);
            } catch (error) {
                registry.close();
                fail(`start() threw: ${error.message || error}`);
                return notStarted(definition);
            }
            const parts = registry.close();
            let exported;
            try {
                exported = structuredClone(snapshotOf(parts.exports || {}));
            } catch (error) {
                fail(`deck.exports() takes values that can be copied: ${error.message || error}`);
                return notStarted(definition);
            }
            contribute(definition, parts, { exported, layers, dismiss });
            const tell = (name) => typeof parts[name] === 'function' && deliver(`${name}()`, () => parts[name]());
            return { plugin, definition, parts, tell };
        }

        // A stop() that throws is recorded like any call into the plugin; the sandbox ends either way.
        async function stopOf(definition) {
            try {
                await definition.stop();
            } catch (error) {
                fail(`stop() threw: ${error.message || error}`);
            }
        }

        // It did not start, and why: what the plugins that require it are told.
        function notStarted(definition) {
            PROTOCOL.stopped.send({ run: pageRun, why: String(failures.at(-1) || 'it did not start') });
            return { plugin, definition, parts: null, tell: () => {} };
        }

        // A throw, or a promise that rejects, is recorded against the plugin, never only a console line.
        function deliver(what, listener, ...args) {
            try {
                Promise.resolve(listener(...args)).catch((error) => fail(`${what} threw: ${error.message || error}`));
            } catch (error) {
                fail(`${what} threw: ${error.message || error}`);
            }
        }

        function fail(why) {
            LOG.warn(`${plugin?.id ?? 'a plugin'}: ${why}`);
            failures.push(why);
            PROTOCOL.failed.send({ run: pageRun, why: String(why) });
        }

        // The entry runs as a CommonJS module with nothing else in reach, and is what it sets module.exports to. Who
        // the plugin is comes from its manifest.
        function evaluate(source) {
            const module = { exports: {} };
            try {
                new Function('module', 'exports', `${source}\n//# sourceURL=deckit://${plugin.id}/${plugin.main}`)(
                    module,
                    module.exports
                );
            } catch (error) {
                fail(`${plugin.main} failed to load: ${error.message || error}`);
                return null;
            }
            const definition = module.exports;
            if (!definition || typeof definition !== 'object') {
                fail(`${plugin.main} sets module.exports to no object`);
                return null;
            }
            const unknown = Object.keys(definition).filter((key) => !DEFINITION.has(key));
            if (unknown.length) {
                fail(`module.exports has ${[...DEFINITION].join(', ')}, not ${unknown.join(', ')}`);
                return null;
            }
            if (typeof definition.start !== 'function') {
                fail('module.exports needs start(deck)');
                return null;
            }
            if (definition.stop !== undefined && typeof definition.stop !== 'function') {
                fail('module.exports has a stop that is no function');
                return null;
            }
            return definition;
        }

        // What each plugin it requires exports: values copied and frozen, functions called through main.
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
                        PROTOCOL.callExport.invoke({ plugin: id, path, args })
                    )
                );
            }
            return Object.freeze(out);
        }

        // Values as given, with a function at each path that calls it by its path.
        function proxyOf(functions, values, call) {
            const out = values && typeof values === 'object' ? values : {};
            for (const path of functions) {
                let at = out;
                for (const key of path.slice(0, -1)) at = at[key] ??= {};
                at[path.at(-1)] = (...args) => call(path, args);
            }
            return out;
        }

        // What start() registers, each once and only while it runs: deck contributes it all when start() ends.
        function registryOf() {
            const registered = {};
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
            return {
                register: {
                    view: once('view', view),
                    keys: once('keys', table),
                    commands: once('commands', fn),
                    now: once('now', fn),
                    resolve: once('resolve', fn),
                    handleURL: once('handleURL', fn),
                    exports: once('exports', table),
                },
                // The parts deck contributes: the view's, its keys, its switcher answers, its URL handler, its exports.
                close() {
                    open = false;
                    const { view: shown = {}, ...rest } = registered;
                    return { ...rest, ...shown };
                },
            };
        }

        function deckOf({ theme, ui, settings, requires, show, register }) {
            const has = (permission) => plugin.permissions.some(({ id }) => id === permission);
            const opener = { open: (url, options) => OPEN.open(url, options) };
            return Object.freeze({
                id: plugin.id,
                name: plugin.name,
                theme,
                ui,
                settings,
                storage: Object.freeze({ values: STORAGE.values(), records: STORAGE.records(fail) }),
                web: WEB.forPlugin({
                    pluginId: plugin.id,
                    permissions: plugin.permissions.map(({ id }) => id),
                    owner: { deliver, recordFailure: fail },
                    opener,
                }),
                requires,
                util: Object.freeze({ match: MATCH.match, ranker: RANKER.ranker, movePath, tildify: tildifyOf() }),
                ...register,
                show,
                open: (url, options) => OPEN.open(url, options),
                reveal: OPEN.reveal,
                fileURL: OPEN.fileURL,
                filePath: OPEN.filePath,
                about: RUNTIME.about,
                chordOf: (action) => KEYMAP.chord(`${plugin.id}.${action}`),
                clipboard: Object.freeze(
                    has('system.clipboard')
                        ? { readText: CLIPBOARD.readText, writeText: CLIPBOARD.writeText }
                        : { writeText: CLIPBOARD.writeText }
                ),
                ...(has('system.notifications') ? { notify: NOTIFY.notify } : {}),
                ...(has('system.main-process') ? { mainProcess: mainProcessOf() } : {}),
                ...(has('deckit.plugins') ? { plugins: pluginsTool() } : {}),
                ...(has('deckit.plugin-settings') ? { pluginSettings: pluginSettingsTool() } : {}),
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
                ...(plugin.id === CONFIG.id && HOST ? { host: deepFreeze({ ...HOST }) } : {}),
            });
        }

        // deck.mainProcess(path): the module started once, its methods called through main, `on(name, listener)`
        // for what it emits. A start that failed is tried again the next time it is asked for.
        function mainProcessOf() {
            const listeners = new Map(); // `${path}\0${name}` -> Set
            const started = new Map(); // the path asked for -> promise of the module's proxy
            PROTOCOL.mainProcessEvent.on(({ path, name, args }) => {
                for (const listener of listeners.get(`${path}\0${name}`) || [])
                    deliver(`on("${name}")`, listener, ...args);
            });
            const moduleOf = ({ path, methods }) => {
                const proxy = proxyOf(methods, {}, (method, args) =>
                    PROTOCOL.callMainProcess.invoke({ path, method, args })
                );
                proxy.on = (name, listener) => {
                    const key = `${path}\0${name}`;
                    if (!listeners.has(key)) listeners.set(key, new Set());
                    listeners.get(key).add(listener);
                    return () => listeners.get(key).delete(listener);
                };
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

        function pluginsTool() {
            return Object.freeze({
                list: () => PROTOCOL.plugins.invoke(),
                pick: () => PROTOCOL.pick.invoke(),
                install: (from) => PROTOCOL.install.invoke({ from: String(from) }),
                remove: (id, data) => PROTOCOL.remove.invoke({ id: String(id), data: !!data }),
                reveal: (id) => PROTOCOL.reveal.invoke({ id: String(id) }),
                count: (id) => PROTOCOL.count.invoke({ id: String(id) }),
                restartPending: () => PROTOCOL.restartPending.invoke(),
                restart: RUNTIME.restart,
            });
        }

        function pluginSettingsTool() {
            return Object.freeze({
                list: () => PROTOCOL.pluginSettings.invoke(),
                set: (id, key, value) => PROTOCOL.setPluginSetting.invoke({ plugin: id, key, value }),
                run: (id, key) => PROTOCOL.runPluginSetting.invoke({ plugin: id, key }),
            });
        }

        function contribute(definition, parts, { exported, layers, dismiss }) {
            const names = plugin.urlSchemes;
            const opens = typeof parts.handleURL === 'function';
            if (names.length && !opens)
                fail('manifest.toml names url-schemes, but start() registered no deck.handleURL()');
            if (opens && !names.length)
                fail('start() registered deck.handleURL(), but manifest.toml names no url-schemes, so nothing asks it');
            if (names.length && opens) OPEN.answer((url, options) => parts.handleURL(url, options));
            SWITCHER.source({
                icon: definition.icon,
                aliases: definition.keywords,
                open: !!parts.content,
                commands: guarded('commands', parts.commands),
                now: guarded('now', parts.now),
                resolve: typeof parts.resolve === 'function' ? (query) => parts.resolve(query) : null,
                invalid: fail,
            });
            KEYMAP.scope(parts.keys, {
                invalid: fail,
                global: plugin.permissions.some(({ id }) => id === 'system.global-keys'),
                onScreen: !!parts.content,
            });
            KEYMAP.connect({ layers, deliver, dismiss });
            PROTOCOL.exportCalled.handle(({ path, args }) => {
                const exported = path.reduce((at, key) => at?.[key], parts.exports);
                if (typeof exported !== 'function')
                    throw new Error(`${plugin.id} exports no function ${path.join('.')}`);
                return exported(...args);
            });
            PROTOCOL.started.send({
                run: pageRun,
                exports: exported,
                summary: {
                    icon: String(definition.icon || ''),
                    view: !!parts.content,
                    sidebar: !!parts.sidebar,
                    commands: typeof parts.commands === 'function',
                    now: typeof parts.now === 'function',
                    resolver: typeof parts.resolve === 'function',
                    urlSchemes: opens ? names : [],
                    exports: !!parts.exports,
                    requires: Object.keys(plugin.requires),
                },
            });
        }

        // The one place a plugin's function is called for a value. Asked again while still answering (its
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
        function snapshotOf(exported) {
            const functions = [];
            const walk = (value, path, holding) => {
                if (typeof value === 'function') {
                    functions.push(path);
                    return undefined;
                }
                if (!value || typeof value !== 'object') return value;
                if (holding.includes(value)) throw new Error(`exports.${path.join('.')} holds itself`);
                const out = Array.isArray(value) ? [] : {};
                for (const [key, inner] of Object.entries(value)) {
                    const copied = walk(inner, [...path, key], [...holding, value]);
                    if (copied !== undefined) out[key] = copied;
                }
                return out;
            };
            return { values: walk(exported, [], []), functions };
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
