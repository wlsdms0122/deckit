DeckitModule.define(
    'deckit/service/plugin/client',
    {
        uses: [
            'deckit/service/home/model/config',
            'deckit/service/storage/model/space',
            'deckit/service/web/client',
            'deckit/service/notify/client',
            'deckit/module/clipboard/client',
            'deckit/service/runtime/client',
            'deckit/module/query/match',
            'deckit/module/query/ranker',
            'deckit/service/open/client',
            'deckit/service/keymap/client',
            'deckit/service/switcher/client',
            'deckit/service/plugin/model/protocol',
            'app/exports?',
        ],
        provides: ['list', 'arrange', 'build', 'load', 'installed', 'listen'],
    },
    (
        CONFIG,
        DATA_RULES,
        WEB,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        MATCH,
        RANKER,
        OPEN,
        KEYMAP,
        SWITCHER,
        PROTOCOL,
        APP_EXPORTS
    ) => {
        let PANEL = null;

        const safeHost = (url) => {
            try {
                return new URL(url).hostname;
            } catch {
                return '';
            }
        };
        const canon = (u) => {
            try {
                return new URL(u).href;
            } catch {
                return u;
            }
        };
        const { match } = MATCH;
        const { ranker } = RANKER;
        // `to` null means gone: a path at or inside `from` becomes null. Paths are "/"-separated.
        const movePath = (p, from, to) =>
            typeof p !== 'string' || (p !== from && !p.startsWith(from + '/'))
                ? p
                : to == null
                  ? null
                  : to + p.slice(from.length);
        // One object handed to every plugin, so frozen: a plugin writing to it would change it for every other.
        const util = Object.freeze({ safeHost, canon, match, ranker, movePath });

        const PLUGINS = []; // filled by Deckit.register(), in the order they are listed

        /* A plugin's `order` places it the first time it is seen. A dragged arrangement then places the
     plugins it names, and any other keeps the place its `order` gives it, so one installed later still
     lands where it asked to. The first is what opens on boot. */
        const registered = []; // in the order they registered, which is what breaks ties in `order`
        let arrangement = (() => {
            try {
                return PROTOCOL.order.ask() || [];
            } catch {
                return [];
            }
        })();
        /* The plugins `ids` names take the places they already hold in `list`, in the order `ids` gives,
     and the rest stay put. An id named twice or naming nothing is passed over. */
        const placeAmong = (list, ids) => {
            const moved = [...new Set(ids)].map((id) => list.find((p) => p.id === id)).filter(Boolean);
            const out = list.slice();
            out.map((p, i) => (moved.includes(p) ? i : -1))
                .filter((i) => i >= 0)
                .forEach((slot, k) => {
                    out[slot] = moved[k];
                });
            return out;
        };
        const arrange = () => {
            // Files arrive in whatever order the build globbed them, so registering is no order at all.
            const byOrder = registered.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
            // The same array, reordered: the panel holds on to it.
            PLUGINS.splice(0, PLUGINS.length, ...placeAmong(byOrder, arrangement));
        };

        // Namespaced by the app's id, so two apps' state in one profile stays apart.
        const STORE = CONFIG.id + ':';
        /* Handed as context.app only to the plugin whose id is the app's. A plain copy: the module's view
     throws on a name it does not provide (module/registry/index.js). */
        const EMBEDDING_APP = { id: CONFIG.id, exports: APP_EXPORTS ? { ...APP_EXPORTS } : null };
        const readJSON = (key, fallback) => {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch {
                return fallback;
            }
        };
        const writeJSON = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {}
        };
        const makeStore = (pluginId) => ({
            get: (key, fallback) => readJSON(`${STORE}${pluginId}:${key}`, fallback),
            set: (key, value) => writeJSON(`${STORE}${pluginId}:${key}`, value),
            remove: (key) => {
                try {
                    localStorage.removeItem(`${STORE}${pluginId}:${key}`);
                } catch {}
            },
        });

        /* get() is synchronous because make() is. It answers from the cache, so the cache must never hold
     what the file will not: a key main would refuse throws before the cache changes, and a failed
     write puts the cache back. */
        const dataCache = new Map(); // "<plugin>\0<key>" -> parsed value (undefined = no file)
        const dataWatchers = new Map(); // same key -> Set(fn)

        const makeData = (pluginId) => {
            const ck = (key) => pluginId + '\u0000' + key;
            const write = (key, value, send) => {
                const why = DATA_RULES.keyProblem(key);
                if (why) throw new Error(why);
                const k = ck(key);
                const had = dataCache.has(k),
                    before = dataCache.get(k);
                dataCache.set(k, value);
                return send().catch((e) => {
                    // Put back only what this write put there: a later write to the same key is that one's to answer for.
                    if (dataCache.get(k) === value) {
                        if (had) dataCache.set(k, before);
                        else dataCache.delete(k);
                    }
                    recordFailure(pluginId, `could not keep "${key}": ${(e && e.message) || e}`);
                    throw e;
                });
            };
            return {
                get(key, fallback) {
                    const k = ck(key);
                    if (!dataCache.has(k)) {
                        let parsed;
                        try {
                            const raw = PROTOCOL.dataGet.ask({ plugin: pluginId, key }) ?? null;
                            parsed = raw === null ? undefined : JSON.parse(raw);
                        } catch (e) {
                            console.warn('[deckit] data read failed', pluginId, key, e);
                            parsed = undefined;
                        }
                        dataCache.set(k, parsed);
                    }
                    const value = dataCache.get(k);
                    return value === undefined ? fallback : value;
                },
                set(key, value) {
                    return write(key, value, () =>
                        invoke(PROTOCOL.dataSet, { plugin: pluginId, key, json: JSON.stringify(value) })
                    );
                },
                remove(key) {
                    return write(key, undefined, () => invoke(PROTOCOL.dataRemove, { plugin: pluginId, key }));
                },
                keys: () => PROTOCOL.dataKeys.ask({ plugin: pluginId }) || [],
                path: (key = '') => PROTOCOL.dataPath.ask({ plugin: pluginId, key: String(key) }) || '',
                on(key, fn) {
                    const k = ck(key);
                    if (!dataWatchers.has(k)) dataWatchers.set(k, new Set());
                    dataWatchers.get(k).add(fn);
                    return () => dataWatchers.get(k)?.delete(fn);
                },
            };
        };

        const onDataChanged = (pluginId, key) => {
            const k = pluginId + '\u0000' + key;
            // Only a value this page has read can have changed for anyone here.
            const seen = key === SETTINGS_KEY && dataCache.has(k);
            const before = seen ? dataCache.get(k) : undefined;
            dataCache.delete(k); // the next get() reads the file the other window wrote
            for (const fn of dataWatchers.get(k) || []) deliver(pluginId, `data.on("${key}")`, fn);
            if (seen) settingsChangedElsewhere(pluginId, before || {});
        };

        /* Writing "settings" directly would skip the checks and the on() a setting goes through. Any case:
     on a disk that does not tell case apart, "Settings.json" is the same file. */
        const SETTINGS_KEY = 'settings';
        const pluginData = (pluginId) => {
            const data = makeData(pluginId);
            const refuse = (key) => {
                if (String(key).toLowerCase() === SETTINGS_KEY)
                    throw new Error(`"${SETTINGS_KEY}" is the host's, read and changed through context.settings`);
            };
            return {
                ...data,
                set(key, value) {
                    refuse(key);
                    return data.set(key, value);
                },
                remove(key) {
                    refuse(key);
                    return data.remove(key);
                },
            };
        };

        const mainEvents = new Map(); // pluginId -> Map(name -> Set(fn))

        PROTOCOL.event.hear(({ plugin: pluginId, name, args }) => {
            for (const fn of mainEvents.get(pluginId)?.get(name) || [])
                deliver(pluginId, `main.on("${name}")`, fn, ...args);
        });

        /* Electron prefixes a rejection from main with "Error invoking remote method '<channel>': Error: ".
     Stripped, so a message written for a person arrives clean; the original stays on .cause. Only the
     message crosses, so main puts a refusal's kind at its front ("EXISTS: ...", module/file/index.js),
     read back here as `kind`. */
        const invoke = (end, payload) =>
            Promise.resolve()
                .then(() => end.ask(payload))
                .catch((e) => {
                    const said = String((e && e.message) || e).replace(
                        /^Error invoking remote method '[^']*':\s*(Error:\s*)?/,
                        ''
                    );
                    const coded = /^([A-Z][A-Z_]+): ([\s\S]*)$/.exec(said);
                    throw Object.assign(new Error(coded ? coded[2] : said), {
                        cause: e,
                        kind: coded ? coded[1] : null,
                    });
                });

        /* On the host behind `deckit.plugins`, not on a main half: it changes the app's plugin folder, which
     no main half owns. Listing the others is behind it too, so no plugin can come to depend on
     another without `requires`. */
        const SAID_KEY = STORE + 'plugins-said';
        const plugins = {
            running: () => running(),
            // A requirement is met only once the plugin that gives it also started here.
            installed: () =>
                installedList.map((p) => ({
                    ...p,
                    requirements: (p.requirements || []).map((r) => ({ ...r, ok: r.ok && instances.has(r.id) })),
                })),
            pick: () => invoke(PROTOCOL.pick),
            install: (from) => invoke(PROTOCOL.install, { from: String(from || '') }),
            remove: (id, alsoData) => invoke(PROTOCOL.remove, { id: String(id), alsoData: !!alsoData }),
            reveal: (id) => invoke(PROTOCOL.reveal, { id: String(id) }),
            restartPending: () => {
                try {
                    return PROTOCOL.restartPending.ask() || [];
                } catch {
                    return [];
                }
            },
            restart: () => RUNTIME.restart(),
            dataCount: (id) => invoke(PROTOCOL.dataSize, { id: String(id) }),
            /* Main is asked first, since a page reload does not pick up or drop a main half; if that fails
       the page is not reloaded. `said` outlives the reload in sessionStorage, read once by said(). */
            refresh: async (said) => {
                await invoke(PROTOCOL.refresh);
                if (said) {
                    try {
                        sessionStorage.setItem(SAID_KEY, String(said));
                    } catch {}
                }
                location.reload();
            },
            said: () => {
                try {
                    const line = sessionStorage.getItem(SAID_KEY) || '';
                    sessionStorage.removeItem(SAID_KEY);
                    return line;
                } catch {
                    return '';
                }
            },
        };

        const makeMain = (pluginId, running) => ({
            available: !!running,
            call: (op, ...args) => invoke(PROTOCOL.call, { plugin: pluginId, op: String(op), args }),
            on(name, fn) {
                if (!mainEvents.has(pluginId)) mainEvents.set(pluginId, new Map());
                const byName = mainEvents.get(pluginId);
                if (!byName.has(name)) byName.set(name, new Set());
                byName.get(name).add(fn);
                return () => byName.get(name)?.delete(fn);
            },
        });

        let installedList = [];

        const register = (plugin) => {
            if (!plugin || !plugin.id || typeof plugin.make !== 'function') {
                return console.warn('[deckit] invalid plugin definition', plugin);
            }
            if (PLUGINS.some((p) => p.id === plugin.id)) {
                return console.warn('[deckit] duplicate plugin id:', plugin.id);
            }
            registered.push(plugin);
            arrange();
        };
        const SESSION_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
        /* What each permission hands over lives in this table and nowhere else: nothing reaches a plugin
     unless a row puts it there, so a tool forgotten here reaches nobody. A Map, so "constructor" is
     no tool. */
        const GRANTS = new Map([
            // `available`: whether the main half is running.
            [
                'system.main-process',
                { context: (id) => ({ main: makeMain(id, installedList.find((p) => p.id === id)?.mainRunning) }) },
            ],
            // Nothing to hand over: main holds a page to it (service/web/server.js, mayShow).
            ['system.files', {}],
            [
                'system.network',
                { web: (sessionOf) => ({ fetchText: (url, { session } = {}) => sessionOf(session).fetchText(url) }) },
            ],
            ['system.certificates', { session: (web) => ({ trust: web.trust }) }],
            ['system.site-permissions', { session: (web) => ({ allow: web.allow, revoke: web.revoke }) }],
            ['system.clipboard', { host: () => ({ clipboard: CLIPBOARD }) }],
            ['system.notifications', { host: () => ({ notify: NOTIFY.notify }) }],
            // Nothing to hand over: the keymap holds a global key to it (contribute).
            ['system.global-keys', {}],
            ['deckit.plugins', { host: () => ({ plugins }) }],
            ['deckit.plugin-settings', { host: () => ({ pluginSettings }) }],
            [
                'deckit.key-map',
                {
                    host: () => ({
                        keymap: { list: KEYMAP.list, set: KEYMAP.set, reset: KEYMAP.reset, record: KEYMAP.record },
                    }),
                },
            ],
            [
                'deckit.url-schemes',
                { host: () => ({ urlSchemes: { list: OPEN.list, set: OPEN.set, everyScheme: OPEN.everyScheme } }) },
            ],
        ]);
        const grantsOf = (plugin) => plugin.permissions.map(({ id }) => GRANTS.get(id)).filter(Boolean);

        const pageOwner = (pluginId) => ({
            deliver: (what, fn, ...args) => deliver(pluginId, what, fn, ...args),
            recordFailure: (why) => recordFailure(pluginId, why),
        });

        // A session is named only by a handle the plugin was given, so it cannot name one it was not.
        const partitions = new WeakMap(); // session handle -> partition
        const partitionOf = (session) => {
            const partition = partitions.get(session);
            if (!partition) throw new Error('a web page needs a session from context.storage.web(name)');
            return partition;
        };

        // The partition is built from the plugin's id, so a plugin names its own sessions and nobody else's.
        const sessionsFor = (pluginId, grants) => {
            const made = new Map();
            return (name) => {
                if (!SESSION_NAME.test(String(name))) throw new Error('bad session name: ' + name);
                if (made.has(name)) return made.get(name);
                const partition = DATA_RULES.jar(pluginId, name);
                const web = WEB.session(partition);
                const handle = Object.freeze(
                    Object.assign(
                        { name: String(name), clear: web.clear },
                        ...grants.map((g) => g.session?.(web) || {})
                    )
                );
                partitions.set(handle, partition);
                made.set(name, handle);
                return handle;
            };
        };

        const webFor = (plugin, grants) => {
            const owner = pageOwner(plugin.id);
            const sessionOf = (session) => WEB.session(partitionOf(session));
            return Object.freeze(
                Object.assign(
                    {
                        page: ({ session, url = '' } = {}) => WEB.page(partitionOf(session), { url }, owner, session),
                        window: ({ session, url = '', title = '' } = {}) =>
                            WEB.window(partitionOf(session), { url, title }, owner, session),
                    },
                    ...grants.map((g) => g.web?.(sessionOf) || {})
                )
            );
        };

        /* Named one by one rather than spread from another module, so nothing reaches a plugin unless this
     list puts it there. Copying text is everyone's; reading the clipboard is `system.clipboard`. */
        const EVERY_PLUGIN = Object.freeze({
            about: RUNTIME.about,
            open: (url, options) => OPEN.open(url, options),
            fileURL: (file) => OPEN.fileURL(file),
            filePath: (url) => OPEN.filePath(url),
            reveal: (file) => OPEN.reveal(file),
        });
        const COPY_ONLY = Object.freeze({ writeText: CLIPBOARD.writeText });

        const hostFor = (plugin) => {
            const grants = grantsOf(plugin);
            const own = {
                ...EVERY_PLUGIN,
                show: () => PANEL.reveal(plugin.id),
                chordOf: (action) => KEYMAP.chord(plugin.id + '.' + action),
            };
            own.clipboard = COPY_ONLY;
            for (const g of grants) Object.assign(own, g.host?.() || {});
            return own;
        };

        const settingsWatchers = new Map(); // pluginId -> Set(fn)
        const contexts = new Map(); // pluginId -> the context its make() got, for action.run
        const optionsOf = (pluginId, decl) => {
            try {
                return (typeof decl.options === 'function' ? decl.options(contexts.get(pluginId)) : decl.options) || [];
            } catch (e) {
                recordFailure(pluginId, `settings options threw: ${(e && e.message) || e}`);
                return [];
            }
        };
        /* A saved value that is not among the options (one this machine lacks, or one an update took away)
     is offered marked `absent`, and left as it is. */
        const offered = (pluginId, decl, value) => {
            const options = optionsOf(pluginId, decl);
            return options.some((o) => o.value === value)
                ? options
                : [...options, { value, label: String(value), absent: true }];
        };
        const declaredSettings = (pluginId) => PLUGINS.find((p) => p.id === pluginId)?.settings || {};
        const tellSettings = (pluginId, key, value) => {
            for (const fn of settingsWatchers.get(pluginId) || []) deliver(pluginId, 'settings.on', fn, key, value);
        };
        const settingsChangedElsewhere = (pluginId, before) => {
            const now = settingsOf(pluginId);
            for (const [key, decl] of Object.entries(declaredSettings(pluginId))) {
                if (decl.type === 'action') continue;
                const was = Object.prototype.hasOwnProperty.call(before, key) ? before[key] : decl.default;
                const value = now.get(key);
                if (was !== value) tellSettings(pluginId, key, value);
            }
        };
        const settingsOf = (pluginId) => {
            const data = makeData(pluginId);
            const saved = () => data.get(SETTINGS_KEY, {}) || {};
            const get = (key) => {
                const own = saved();
                return Object.prototype.hasOwnProperty.call(own, key)
                    ? own[key]
                    : declaredSettings(pluginId)[key]?.default;
            };
            const set = (key, value) => {
                const decl = declaredSettings(pluginId)[key];
                if (!decl) throw new Error(`${pluginId} has no setting "${key}"`);
                let v = value;
                if (decl.type === 'toggle') v = !!value;
                else if (decl.type === 'number') {
                    v = Number(value);
                    if (!Number.isFinite(v)) throw new Error(`not a number for ${key}: ${value}`);
                    v = Math.min(decl.max ?? Infinity, Math.max(decl.min ?? -Infinity, v));
                } else if (decl.type === 'text') v = String(value ?? '');
                else if (decl.type === 'choice' && !optionsOf(pluginId, decl).some((o) => o.value === v))
                    throw new Error(`not an option of ${key}: ${v}`);
                else if (decl.type === 'action') throw new Error(`${key} is a button, not a value`);
                /* Told once written, so a write that failed (and took the cache back) is never told as a change.
         The same value again is no change. */
                if (get(key) === v) return Promise.resolve();
                return data.set(SETTINGS_KEY, { ...saved(), [key]: v }).then(() => tellSettings(pluginId, key, v));
            };
            const on = (fn) => {
                if (!settingsWatchers.has(pluginId)) settingsWatchers.set(pluginId, new Set());
                settingsWatchers.get(pluginId).add(fn);
                return () => settingsWatchers.get(pluginId)?.delete(fn);
            };
            return { get, set, on };
        };

        const pluginSettings = {
            list: () =>
                PLUGINS.filter((p) => p.settings && Object.keys(p.settings).length && instances.has(p.id)).map((p) => {
                    const s = settingsOf(p.id);
                    return {
                        id: p.id,
                        name: p.name,
                        items: Object.entries(p.settings).map(([key, d]) => ({
                            key,
                            label: d.label || key,
                            hint: d.hint || '',
                            type: d.type,
                            value: d.type === 'action' ? undefined : s.get(key),
                            options: d.type === 'choice' ? offered(p.id, d, s.get(key)) : [],
                            // Options worked out when Settings is drawn (fonts on this Mac): how many is not the plugin's to know.
                            computed: typeof d.options === 'function',
                            min: d.min,
                            max: d.max,
                            step: d.step,
                            unit: d.unit || '',
                            placeholder: d.placeholder || '',
                            button: d.button || d.label || key,
                        })),
                    };
                }),
            set: (id, key, value) => settingsOf(id).set(key, value),
            run: async (id, key) => {
                const decl = declaredSettings(id)[key];
                if (decl?.type !== 'action' || typeof decl.run !== 'function')
                    throw new Error(`${id} has no action "${key}"`);
                const said = await decl.run(contexts.get(id));
                return said == null ? '' : String(said);
            },
        };

        // The rest of context is the panel's and arrives through build().
        const hostContext = (plugin) => {
            const grants = grantsOf(plugin);
            const own = {
                store: makeStore(plugin.id),
                data: pluginData(plugin.id),
                settings: settingsOf(plugin.id),
                util,
                storage: Object.freeze({ web: sessionsFor(plugin.id, grants) }),
                web: webFor(plugin, grants),
            };
            for (const g of grants) Object.assign(own, g.context?.(plugin.id) || {});
            return own;
        };

        const facadeFor = (entry) => ({
            register(plugin) {
                for (const k of ['id', 'name', 'permissions', 'urlSchemes']) {
                    if (plugin && plugin[k] !== undefined) {
                        console.warn(
                            `[deckit] ${entry.id}: ${k} comes from the folder and manifest.toml, ` +
                                `not from register(), so the one in the file is ignored`
                        );
                    }
                }
                register({
                    ...plugin,
                    id: entry.id,
                    name: entry.name,
                    permissions: entry.permissions,
                    urlSchemes: entry.urlSchemes,
                });
            },
        });

        /* Data properties only: an accessor is the provider's own live value. Deep, because what one plugin
     exports is handed to every plugin that requires it. */
        const deepFreeze = (o) => {
            if (o && (typeof o === 'object' || typeof o === 'function') && !Object.isFrozen(o)) {
                Object.freeze(o);
                for (const k of Object.getOwnPropertyNames(o)) {
                    const d = Object.getOwnPropertyDescriptor(o, k);
                    if (d && 'value' in d) deepFreeze(d.value);
                }
            }
            return o;
        };

        const instances = new Map();
        const answering = new Set(); // "<plugin>\0<name>" while ask() is inside that call

        // The first reason is kept: it is the one the others follow.
        const failures = new Map(); // pluginId -> why
        /* Settled when the plugin is made, so Open With, Settings and the running list read one answer, and
     schemes with no open() (or the reverse) are said once against the plugin. */
        const opening = new Map(); // pluginId -> [scheme]
        const recordFailure = (pluginId, why) => {
            console.warn(`[deckit] ${pluginId}: ${why}`);
            if (!failures.has(pluginId)) failures.set(pluginId, String(why));
        };
        // A throw, or a promise that rejects, is recorded against the plugin, never only a console line.
        const deliver = (pluginId, what, fn, ...args) => {
            const fail = (e) => recordFailure(pluginId, `${what} threw: ${(e && e.message) || e}`);
            try {
                Promise.resolve(fn(...args)).catch(fail);
            } catch (e) {
                fail(e);
            }
        };

        // The one place that calls into an instance for a value, so the guard is never left out.
        const ask = (pluginId, name, ...args) => {
            const instance = instances.get(pluginId);
            const offered = instance?.[name];
            if (offered === undefined) return undefined;
            /* Asked again while still answering (its commands() reading the plugin list, which counts
       everyone's commands), it gets nothing instead of a loop. */
            const asking = pluginId + '\0' + name;
            if (answering.has(asking)) return undefined;
            const fail = (why) => {
                recordFailure(pluginId, why);
                return undefined;
            };
            if (typeof offered !== 'function') return fail(`${name} must be a function`);
            answering.add(asking);
            try {
                return offered.apply(instance, args);
            } catch (e) {
                return fail(`${name}() threw: ${(e && e.message) || e}`);
            } finally {
                answering.delete(asking);
            }
        };

        const tell = (pluginId, name, ...args) => {
            const instance = instances.get(pluginId);
            const offered = instance?.[name];
            if (offered === undefined) return;
            if (typeof offered !== 'function') return recordFailure(pluginId, `${name} must be a function`);
            deliver(pluginId, `${name}()`, offered.bind(instance), ...args);
        };

        const contribute = (plugin, instance) => {
            const invalid = (why) => recordFailure(plugin.id, why);
            if (instance.content) {
                PANEL.register({
                    id: plugin.id,
                    name: plugin.name,
                    icon: plugin.icon,
                    content: instance.content,
                    sidebar: instance.sidebar || null,
                    didAppear: () => tell(plugin.id, 'didAppear'),
                    didDisappear: () => tell(plugin.id, 'didDisappear'),
                });
            }
            SWITCHER.register({
                id: plugin.id,
                name: plugin.name,
                icon: plugin.icon,
                aliases: plugin.keywords || [],
                open: instance.content ? () => PANEL.reveal(plugin.id) : null,
                commands: () => ask(plugin.id, 'commands'),
                now: () => ask(plugin.id, 'now'),
                resolve: typeof instance.resolve === 'function' ? (query) => instance.resolve(query) : null,
                invalid,
            });
            KEYMAP.register({
                id: plugin.id,
                name: plugin.name,
                keys: instance.keys,
                invalid,
                global:
                    plugin.permissions.some(({ id }) => id === 'system.global-keys') ||
                    'that takes the system.global-keys permission',
            });
            const schemes = opening.get(plugin.id) || [];
            if (schemes.length) {
                OPEN.register({
                    id: plugin.id,
                    name: plugin.name,
                    schemes,
                    open: (url, options) => instance.open(url, options),
                    invalid,
                });
            }
        };

        // Read off the instances: a plugin that threw on make is absent here as it is from the panel.
        const running = () => {
            // As the keymap has them now, so a remapped chord is listed as remapped.
            const bindings = KEYMAP.list();
            return PLUGINS.flatMap((p) => {
                const instance = instances.get(p.id);
                if (!instance) return [];
                return [
                    {
                        id: p.id,
                        name: p.name,
                        icon: p.icon,
                        order: p.order || 0,
                        view: !!instance.content,
                        sidebar: !!instance.sidebar,
                        commands: (() => {
                            const list = ask(p.id, 'commands');
                            return Array.isArray(list) ? list.length : 0;
                        })(),
                        now: typeof instance.now === 'function',
                        resolver: typeof instance.resolve === 'function',
                        urlSchemes: [...(opening.get(p.id) || [])],
                        exports: !!instance.exports,
                        requires: Object.keys(installedList.find((d) => d.id === p.id)?.requires || {}),
                        keys: bindings
                            .filter((k) => k.owner === p.id && k.active)
                            .map((k) => ({ id: k.id, spec: k.spec, chord: k.chord, label: k.label })),
                        problem: failures.get(p.id) || null,
                    },
                ];
            });
        };

        // Each file is run on its own, so a syntax error or a top-level throw costs that plugin alone.
        const evaluate = (entry, source, kind) => {
            try {
                new Function('Deckit', String(source) + '\n//# sourceURL=deckit://' + kind + '/' + entry.id)(
                    facadeFor(entry)
                );
                return '';
            } catch (e) {
                console.error('[deckit] ' + kind + ' ' + entry.id + ' failed to load', e);
                return String((e && e.message) || e);
            }
        };

        return {
            list: () => PLUGINS,
            // The plugins `ids` names take the places they held between them, so the panel can hand over only the ones it lists.
            arrange(ids) {
                arrangement = placeAmong(PLUGINS, ids).map((p) => p.id);
                arrange();
                // Each contribution point is told the order, so none keeps a stale copy.
                const order = PLUGINS.map((p) => p.id);
                OPEN.arrange(order);
                SWITCHER.arrange(order);
                KEYMAP.arrange(order);
                // Lost, it costs one drag to make again, so a warning is enough.
                invoke(PROTOCOL.setOrder, { ids: arrangement }).catch((e) =>
                    console.warn('[deckit] the plugin order was not saved', e)
                );
            },

            /* A plugin that returns nothing to show is still built: headless is a shape, not a failure. A
       make() that returns no object is refused, or a forgotten `return` would be a plugin that half
       started and is built again when another requires it. Main already refused a missing or too old
       requirement; what can still fail here is that the other failed on its way up. */
            build(shared, { panel }) {
                PANEL = panel;
                const byId = new Map(PLUGINS.map((p) => [p.id, p]));
                const failed = new Set();
                const refuse = (id, why) => {
                    failed.add(id);
                    const entry = installedList.find((p) => p.id === id);
                    if (entry && !entry.error) entry.error = why;
                };
                const make = (plugin) => {
                    if (instances.has(plugin.id) || failed.has(plugin.id)) return;
                    // The schema refused unknown names already; a name with no tool here means the two drifted.
                    const unknown = plugin.permissions.filter(({ id }) => !GRANTS.has(id));
                    if (unknown.length)
                        return refuse(
                            plugin.id,
                            `no tool for permission ${unknown.map(({ id }) => `"${id}"`).join(', ')}`
                        );
                    const wants = installedList.find((p) => p.id === plugin.id)?.requires || {};
                    const requires = {};
                    for (const id of Object.keys(wants)) {
                        if (byId.has(id)) make(byId.get(id));
                        const other = instances.get(id);
                        if (!other) return refuse(plugin.id, `needs ${id}, which did not start`);
                        requires[id] = deepFreeze(other.exports || {});
                    }
                    let instance;
                    const context = {
                        ...shared,
                        ...hostContext(plugin),
                        host: hostFor(plugin),
                        requires: Object.freeze(requires),
                        ...(plugin.id === EMBEDDING_APP.id && EMBEDDING_APP.exports
                            ? { app: deepFreeze(EMBEDDING_APP.exports) }
                            : {}),
                    };
                    contexts.set(plugin.id, context);
                    try {
                        instance = plugin.make(context);
                    } catch (e) {
                        console.warn('[deckit] plugin failed to make:', plugin.id, e);
                        return refuse(plugin.id, 'make() threw: ' + ((e && e.message) || e));
                    }
                    if (!instance || typeof instance !== 'object') return refuse(plugin.id, 'make() returned nothing');
                    // An async make() is a promise, not the parts: it would stand as a plugin with nothing in it.
                    if (typeof instance.then === 'function')
                        return refuse(
                            plugin.id,
                            "make() returned a promise; it has to return the plugin's parts themselves"
                        );
                    instances.set(plugin.id, instance);
                    const named = plugin.urlSchemes || [],
                        answers = typeof instance.open === 'function';
                    if (named.length && !answers)
                        recordFailure(plugin.id, 'manifest.toml names url-schemes, but make() returned no open()');
                    else if (answers && !named.length)
                        recordFailure(
                            plugin.id,
                            'make() returned open(), but manifest.toml names no url-schemes, so nothing asks it'
                        );
                    opening.set(plugin.id, answers ? named : []);
                };
                for (const plugin of PLUGINS) make(plugin);
                // Registered in the order they are listed, which is the order each contribution point shows them in.
                for (const plugin of PLUGINS)
                    if (instances.has(plugin.id)) contribute(plugin, instances.get(plugin.id));
                return PLUGINS.filter((p) => instances.has(p.id)).map((p) => p.id);
            },

            load() {
                let list = [];
                try {
                    list = PROTOCOL.list.ask() || [];
                } catch {}
                for (const p of list) {
                    if (!p.source) continue;
                    const why = evaluate(p, p.source, 'plugin');
                    if (why) p.error = why;
                }
                // The source is the largest thing here and nothing reads it twice.
                installedList = list.map(({ source, ...rest }) => rest);
                return installedList;
            },
            installed: () => installedList.map((p) => ({ ...p })),

            listen: () => {
                PROTOCOL.dataChanged.hear(({ plugin, key }) => onDataChanged(plugin, key));
            },
        };
    }
);
