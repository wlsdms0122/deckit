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
            'deckit/service/plugin/host/protocol',
            'app/exports?',
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
        APP
    ) => {
        // MARK: - Property
        const DEFINITION = new Set(['icon', 'keywords', 'settings', 'make']);
        const PARTS = new Set([
            'content',
            'sidebar',
            'commands',
            'now',
            'resolve',
            'open',
            'keys',
            'exports',
            'didAppear',
            'didDisappear',
        ]);
        const failures = [];
        let plugin = null;

        // MARK: - Initializer
        // MARK: - Public
        // The plugin this view runs, made and contributed. `show` puts it on screen and `dismiss` puts the panel away;
        // `layers` is what floats in the page. Resolves { plugin, definition, parts, tell }, parts null when it did not
        // start; `tell(name)` calls one of its parts (didAppear, didDisappear) the way every call into it is made.
        async function start(options) {
            try {
                return await run(options);
            } catch (error) {
                fail(`deckit could not start it: ${error.message || error}`);
                return stop(null);
            }
        }

        // MARK: - Private
        async function run({ theme, ui, layers, show, dismiss }) {
            const loaded = PROTOCOL.load.invoke();
            plugin = loaded.manifest;
            WEB.listen();
            NOTIFY.listen(deliver);
            const definition = evaluate(loaded.source);
            if (!definition) return stop(null);
            const requires = await requirementsOf();
            if (!requires) return stop(definition);
            let context = null;
            const settings = SETTINGS.of({
                declared: definition.settings || {},
                saved: loaded.settings,
                context: () => context,
                deliver,
                fail,
            });
            context = contextOf({ theme, ui, settings, requires, main: loaded.main, show });
            const parts = make(definition, context);
            if (!parts) return stop(definition);
            contribute(definition, parts, { layers, dismiss });
            const tell = (name) => typeof parts[name] === 'function' && deliver(`${name}()`, () => parts[name]());
            return { plugin, definition, parts, tell };
        }

        function stop(definition) {
            PROTOCOL.stopped.send({ why: String(failures.at(-1) || 'it did not start') });
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
            PROTOCOL.failed.send({ why: String(why) });
        }

        // The plugin's files run as one function body with only the Deckit facade in reach, and say what the plugin
        // is with Deckit.register(). Who it is comes from its folder and manifest.
        function evaluate(source) {
            let definition = null;
            const facade = Object.freeze({
                register(given) {
                    if (definition) return fail('register() is called once');
                    const unknown = Object.keys(given || {}).filter((key) => !DEFINITION.has(key));
                    if (unknown.length)
                        return fail(`register() takes ${[...DEFINITION].join(', ')}, not ${unknown.join(', ')}`);
                    if (typeof given.make !== 'function') return fail('register() needs make(context)');
                    definition = given;
                },
            });
            try {
                new Function('Deckit', `${source}\n//# sourceURL=deckit://${plugin.id}/page.js`)(facade);
            } catch (error) {
                fail(`page.js failed to load: ${error.message || error}`);
                return null;
            }
            if (!definition) fail('page.js never called Deckit.register()');
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
                out[id] = proxyOf(id, exported);
            }
            return Object.freeze(out);
        }

        function proxyOf(id, { values, functions }) {
            const out = structuredClone(values);
            for (const path of functions) {
                let at = out;
                for (const key of path.slice(0, -1)) at = at[key] ??= {};
                at[path.at(-1)] = (...args) => PROTOCOL.callExport.invoke({ plugin: id, path, args });
            }
            return deepFreeze(out);
        }

        function contextOf({ theme, ui, settings, requires, main, show }) {
            const has = (permission) => plugin.permissions.some(({ id }) => id === permission);
            const opener = { open: (url, options) => OPEN.open(url, options) };
            const host = {
                show,
                open: (url, options) => OPEN.open(url, options),
                reveal: OPEN.reveal,
                fileURL: OPEN.fileURL,
                filePath: OPEN.filePath,
                about: RUNTIME.about,
                chordOf: (action) => KEYMAP.chord(`${plugin.id}.${action}`),
                clipboard: has('system.clipboard')
                    ? { readText: CLIPBOARD.readText, writeText: CLIPBOARD.writeText }
                    : { writeText: CLIPBOARD.writeText },
                ...(has('system.notifications') ? { notify: NOTIFY.notify } : {}),
                ...(has('deckit.plugins') ? { plugins: pluginsTool() } : {}),
                ...(has('deckit.plugin-settings') ? { pluginSettings: pluginSettingsTool() } : {}),
                ...(has('deckit.key-map')
                    ? {
                          keymap: {
                              list: KEYMAP.bindings,
                              set: KEYMAP.bind,
                              reset: KEYMAP.reset,
                              record: KEYMAP.record,
                              onChange: KEYMAP.onChange,
                          },
                      }
                    : {}),
                ...(has('deckit.url-schemes')
                    ? { urlSchemes: { list: OPEN.lines, set: OPEN.setLine, everyScheme: OPEN.EVERY } }
                    : {}),
            };
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
                host: Object.freeze(host),
                requires,
                util: Object.freeze({ match: MATCH.match, ranker: RANKER.ranker, movePath, tildify: tildifyOf() }),
                ...(has('system.main-process') ? { main: mainOf(main) } : {}),
                ...(plugin.id === CONFIG.id && APP ? { app: deepFreeze({ ...APP }) } : {}),
            });
        }

        function mainOf({ running }) {
            const listeners = new Map(); // event name -> Set
            PROTOCOL.mainEvent.on(({ name, args }) => {
                for (const listener of listeners.get(name) || []) deliver(`main.on("${name}")`, listener, ...args);
            });
            return Object.freeze({
                available: running,
                call: (op, ...args) => PROTOCOL.callMain.invoke({ op: String(op), args }),
                on(name, listener) {
                    if (!listeners.has(name)) listeners.set(name, new Set());
                    listeners.get(name).add(listener);
                    return () => listeners.get(name).delete(listener);
                },
            });
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

        // A make() that returns no object is refused, or a forgotten return would be a plugin that half started.
        // Headless, with nothing to show, is a shape, not a failure.
        function make(definition, context) {
            let parts;
            try {
                parts = definition.make(context);
            } catch (error) {
                fail(`make() threw: ${error.message || error}`);
                return null;
            }
            if (!parts || typeof parts !== 'object') {
                fail('make() returned nothing');
                return null;
            }
            if (typeof parts.then === 'function') {
                fail("make() returned a promise; it has to return the plugin's parts");
                return null;
            }
            const unknown = Object.keys(parts).filter((key) => !PARTS.has(key));
            if (unknown.length) fail(`make() returned ${unknown.join(', ')}, which deckit does not read`);
            return parts;
        }

        function contribute(definition, parts, { layers, dismiss }) {
            const names = plugin.urlSchemes;
            const opens = typeof parts.open === 'function';
            if (names.length && !opens) fail('manifest.toml names url-schemes, but make() returned no open()');
            if (opens && !names.length)
                fail('make() returned open(), but manifest.toml names no url-schemes, so nothing asks it');
            if (names.length && opens) OPEN.answer((url, options) => parts.open(url, options));
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
            });
            KEYMAP.connect({ layers, deliver, dismiss });
            PROTOCOL.exportCalled.handle(({ path, args }) => {
                const exported = path.reduce((at, key) => at?.[key], parts.exports);
                if (typeof exported !== 'function')
                    throw new Error(`${plugin.id} exports no function ${path.join('.')}`);
                return exported(...args);
            });
            PROTOCOL.started.send({
                settings: SETTINGS.declarationsOf(definition.settings, fail),
                exports: snapshotOf(parts.exports || {}),
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

        // Values as data, functions as the paths main calls them by.
        function snapshotOf(exported) {
            const functions = [];
            const walk = (value, path) => {
                if (typeof value === 'function') {
                    functions.push(path);
                    return undefined;
                }
                if (!value || typeof value !== 'object') return value;
                const out = Array.isArray(value) ? [] : {};
                for (const [key, inner] of Object.entries(value)) {
                    const copied = walk(inner, [...path, key]);
                    if (copied !== undefined) out[key] = copied;
                }
                return out;
            };
            return { values: walk(exported, []), functions };
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
