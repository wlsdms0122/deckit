DeckitModule.define(
    'deckit/service/plugin/server',
    {
        uses: [
            'deckit/service/home/model/config',
            'deckit/service/home',
            'deckit/service/storage/model/space',
            'deckit/service/storage',
            'deckit/module/file',
            'deckit/module/store',
            'deckit/service/plugin/model/manifest',
            'deckit/service/plugin/folder',
            'deckit/service/plugin/install',
            'deckit/service/plugin/remove',
            'deckit/service/plugin/model/protocol',
        ],
        provides: ['permissions', 'start'],
    },
    (CONFIG, home, DATA_RULES, storage, files, STORE, MANIFEST, FOLDER, INSTALL, REMOVE, PROTOCOL) => {
        const fs = require('fs');
        const path = require('path');

        // A source is read, never written, and comes before the plugin root, so the folder being edited is the one that runs.
        const PLUGIN_ROOT = home.pluginInstall.root;
        const PLUGIN_SOURCES = (process.env.DECKIT_PLUGIN_SOURCES || '').split(path.delimiter).filter(Boolean);
        const pluginFolders = () => {
            const found = new Map();
            for (const root of [...PLUGIN_SOURCES, PLUGIN_ROOT]) {
                for (const folder of INSTALL.folders(root)) {
                    const dir = path.join(root, folder);
                    if (found.has(folder)) {
                        if (fs.existsSync(path.join(dir, MANIFEST.FILE)))
                            console.warn(`[deckit] ${dir} is hidden by ${found.get(folder).dir}`);
                        continue;
                    }
                    found.set(folder, { dir, installed: root === PLUGIN_ROOT });
                }
            }
            return found;
        };

        const dataKey = (raw) => {
            const why = DATA_RULES.keyProblem(raw);
            if (why) throw new Error(why);
            return String(raw);
        };
        const { idProblem } = MANIFEST;
        /* Every read, write, count and removal of plugin data goes through here, so the id rule also keeps
     data/host, the app's own, out of a plugin's reach. */
        const pluginDataDir = (pluginId) => {
            const why = idProblem(pluginId);
            if (why) throw new Error(why);
            return storage.folderOf(pluginId);
        };
        const dataFile = (pluginId, key) => path.join(pluginDataDir(pluginId), dataKey(key) + '.json');
        // Not the id rule: removing a folder whose name breaks it is how it gets cleaned up.
        const listedFolder = (raw) => {
            const folder = String(raw || '');
            const found = pluginFolders().get(folder);
            if (!found) throw new Error('no plugin folder named ' + folder);
            return { folder, ...found };
        };

        const { satisfies } = MANIFEST;

        const requirementOf = (id, want, dep) => {
            if (!dep) return `needs ${id}, which is not installed`;
            if (dep.error) return `needs ${id}, which did not load`;
            if (!satisfies(dep.version, want))
                return `needs ${id} ${want}, and ${id} is ${dep.version || 'unversioned'}`;
            return null;
        };

        /* Failing spreads: a plugin whose requirement did not load did not load either, so this runs
     until nothing changes. A cycle fails every plugin in it. */
        const checkRequires = (entries) => {
            const byId = new Map(entries.map((e) => [e.id, e]));
            const providerOf = (id) => byId.get(id);
            const fail = (e, why) => {
                e.error = why;
                e.source = null;
            };
            const state = new Map(); // id -> "visiting" | "done"
            const visit = (e, trail) => {
                if (state.get(e.id) === 'done') return;
                if (state.get(e.id) === 'visiting') {
                    const loop = trail.slice(trail.indexOf(e.id)).concat(e.id);
                    for (const id of new Set(loop)) {
                        const x = byId.get(id);
                        if (x && !x.error) fail(x, 'requires itself: ' + loop.join(' → '));
                    }
                    return;
                }
                state.set(e.id, 'visiting');
                for (const id of Object.keys(e.requires || {})) {
                    const dep = byId.get(id);
                    if (dep) visit(dep, trail.concat(e.id));
                }
                state.set(e.id, 'done');
            };
            for (const e of entries) visit(e, []);
            for (let changed = true; changed; ) {
                changed = false;
                for (const e of entries) {
                    if (e.error) continue;
                    for (const [id, want] of Object.entries(e.requires || {})) {
                        const why = requirementOf(id, want, providerOf(id));
                        if (why) {
                            fail(e, why);
                            changed = true;
                            break;
                        }
                    }
                }
            }
            // Whether the provider also started in the panel is added by client.js, installed().
            for (const e of entries) {
                e.requirements = Object.entries(e.requires || {}).map(([id, want]) => {
                    const p = providerOf(id);
                    return { id, want, name: p?.name || id, ok: !requirementOf(id, want, p) };
                });
            }
            return entries;
        };

        // Path order keeps the concatenation the same on every machine.
        const jsFiles = (root) => {
            const out = [];
            const walk = (rel) => {
                let entries = [];
                try {
                    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
                } catch {
                    return;
                }
                for (const e of entries) {
                    const next = rel ? path.join(rel, e.name) : e.name;
                    if (e.isDirectory()) walk(next);
                    else if (e.name.endsWith('.js')) out.push(next);
                }
            };
            walk('');
            return out.sort();
        };

        const viewSource = (dir) => {
            const partsDir = path.join(dir, 'view');
            return [
                ...jsFiles(partsDir).map((f) => `/* view/${f} */\n` + fs.readFileSync(path.join(partsDir, f), 'utf8')),
                '/* view.js */\n' + fs.readFileSync(path.join(dir, 'view.js'), 'utf8'),
            ].join('\n;\n');
        };

        /* Only for a plugin the app ships: one from a person's own folder is not the app's to bring back.
     The shipped list is read on each listing, since an install outside the app rewrites it. */
        let shipped = new Set();
        const restoreFor = (id, installed) =>
            installed && CONFIG.restore && shipped.has(id) ? CONFIG.restore.split('{id}').join(id) : null;

        // As the last listing read them.
        const asked = new Map(); // plugin id -> Set of permission ids
        const permissions = Object.freeze({ has: (pluginId, permission) => !!asked.get(pluginId)?.has(permission) });

        const listPlugins = () => {
            shipped = INSTALL.shipped() || new Set();
            const out = [];
            for (const [folder, { dir, installed }] of [...pluginFolders()].sort(([a], [b]) => a.localeCompare(b))) {
                // No manifest is not a broken plugin but no plugin: a stray folder.
                if (!fs.existsSync(path.join(dir, MANIFEST.FILE))) continue;
                const { manifest, problem } = FOLDER.loadable(dir);
                // `installed`: whether a removal can reach it. A source's folder is not the app's to delete.
                const entry = {
                    ...manifest,
                    dir,
                    installed,
                    restore: restoreFor(folder, installed),
                    hasMain: false,
                    source: null,
                    error: null,
                };
                const fail = (why) => {
                    entry.error = why;
                    out.push(entry);
                };
                if (problem) {
                    fail(problem);
                    continue;
                }
                // loadable held main.js and MAIN_PERMISSION to agree, so the permission says it.
                entry.hasMain = manifest.permissions.some((p) => p.id === MANIFEST.MAIN_PERMISSION);
                try {
                    entry.source = viewSource(dir);
                } catch (e) {
                    fail('cannot read view.js: ' + e.message);
                    continue;
                }
                out.push(entry);
            }
            asked.clear();
            for (const e of out) if (!e.error) asked.set(e.id, new Set(e.permissions.map((p) => p.id)));
            return checkRequires(out);
        };

        /* Loaded once, at startup, not per panel: a main half holds state (a daemon's token, a watcher),
     and loading it twice would make two of everything. */
        const pluginOps = new Map(); // pluginId -> Map(op -> fn)
        const mainErrors = new Map(); // pluginId -> why its main half did not load
        const loadedHash = new Map(); // pluginId -> mainHash of the code that is running
        const loadedDir = new Map(); // pluginId -> the folder that code was required from

        const mainHash = (dir) => {
            try {
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'main.js')));
                for (const f of jsFiles(path.join(dir, 'main'))) {
                    hash.update('\0' + f + '\0').update(fs.readFileSync(path.join(dir, 'main', f)));
                }
                return hash.digest('hex');
            } catch {
                return null;
            }
        };

        /* A required module stays cached even when it threw, so a fixed version installed later would load
     the broken one. Forgotten by the folder it was required from, not always the one the id names now. */
        const forgetModule = (dir) => {
            // The cache is keyed by the real path, which differs when the plugin root sits behind a symlink.
            let real = dir;
            try {
                real = fs.realpathSync(dir);
            } catch {}
            for (const k of Object.keys(require.cache)) {
                if (k.startsWith(dir + path.sep) || k.startsWith(real + path.sep)) delete require.cache[k];
            }
        };

        const loadPluginMain = (entry) => {
            const ops = new Map();
            const handle = (name, fn) => {
                if (typeof fn !== 'function') throw new Error('handle(' + name + ') wants a function');
                ops.set(String(name), fn);
            };
            // No sender to skip: this did not come from a page.
            const send = (name, ...args) =>
                broadcast(null, PROTOCOL.event, { plugin: entry.id, name: String(name), args });
            try {
                // The id is folded into the key, so two plugins asking for "log" get two windows and neither can close the other's.
                const openWindow = (opts = {}) =>
                    FRAME.open({
                        ...opts,
                        key: entry.id + ':' + (opts.key || 'main'),
                    });
                const pluginWindow = {
                    open: openWindow,
                    get: (k) => FRAME.get(entry.id + ':' + (k || 'main')),
                    close: (k) => FRAME.close(entry.id + ':' + (k || 'main')),
                };
                require(path.join(entry.dir, 'main.js'))({
                    id: entry.id,
                    dir: entry.dir,
                    data: pluginDataDir(entry.id),
                    handle,
                    send,
                    window: pluginWindow,
                    files,
                });
                pluginOps.set(entry.id, ops);
                mainErrors.delete(entry.id);
                loadedHash.set(entry.id, mainHash(entry.dir));
                loadedDir.set(entry.id, entry.dir);
                console.log('[deckit] ' + entry.id + ' main half: ' + (Array.from(ops.keys()).join(', ') || 'no ops'));
            } catch (e) {
                // The view still loads, and Settings says what is missing.
                console.error('[deckit] ' + entry.id + ' main half failed to load', e);
                mainErrors.set(entry.id, String((e && e.message) || e));
                forgetModule(entry.dir);
            }
        };

        const loadPluginMains = () => {
            for (const entry of listPlugins()) {
                if (entry.error || !entry.hasMain) continue;
                loadPluginMain(entry);
            }
        };
        let FRAME = null;
        const start = ({ frame }) => {
            if (FRAME) throw new Error("[deckit] the plugins' main halves start once");
            FRAME = frame;
            try {
                loadPluginMains();
            } catch (e) {
                console.error('[deckit] plugin main halves failed', e);
            }
        };

        const readManifest = (dir) => {
            const { manifest, problem } = FOLDER.loadable(dir);
            if (problem) throw new Error(problem);
            return manifest;
        };

        /* A main half once required stays in the process, so a reload does not replace it: an update whose
     main code changed is not in effect until a restart. Kept in main because the panel reloads right
     after an install. Compared with the running code, not the replaced folder (that may be an earlier
     update nobody restarted for), so a view-only update asks for no restart. */
        const restartFor = new Map(); // id -> "updated" | "removed" | "reinstalled"

        // Asked at pick as well as at install, so a refused folder is refused before the person is asked about it.
        const installProblem = (src, id) => {
            // A source of the same id is read first (pluginFolders), so the copy would be installed and never load.
            const shadow = pluginFolders().get(id);
            if (shadow && !shadow.installed)
                return `${id} is read from ${shadow.dir}, which would hide the installed copy`;
            return INSTALL.copyProblem(src, id);
        };

        const installPlugin = (src) => {
            const info = readManifest(src);
            const dest = path.join(PLUGIN_ROOT, info.id);
            const why = installProblem(src, info.id);
            if (why) throw new Error(why);
            const replaced = fs.existsSync(dest);
            INSTALL.install(src, info.id);
            if (restartFor.get(info.id) === 'removed') restartFor.set(info.id, 'reinstalled');
            else if (pluginOps.has(info.id) && mainHash(dest) !== loadedHash.get(info.id))
                restartFor.set(info.id, 'updated');
            else if (pluginOps.has(info.id)) restartFor.delete(info.id);
            return { ...info, replaced, restart: restartFor.has(info.id) };
        };

        /* Picking and installing are two calls because the person is asked between them. install takes any
     folder (a script or a test names one): a plugin already runs main.js in this process, so
     restricting it would guard nothing. */
        PROTOCOL.pick.answer(async () => {
            const { dialog } = require('electron');
            const r = await dialog.showOpenDialog({
                title: 'Choose a plugin folder',
                buttonLabel: 'Choose',
                properties: ['openDirectory'],
                message: 'Pick the folder that has manifest.toml in it',
            });
            if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
            const from = r.filePaths[0];
            const info = readManifest(from);
            const why = installProblem(from, info.id);
            if (why) throw new Error(why);
            return { ...info, from, replaces: fs.existsSync(path.join(PLUGIN_ROOT, info.id)) };
        });

        PROTOCOL.install.answer(async ({ from }) => {
            if (!from) throw new Error('no plugin folder was named');
            return installPlugin(from);
        });

        PROTOCOL.remove.answer(async ({ id, alsoData }) => {
            const { folder, dir, installed } = listedFolder(id);
            if (!installed)
                throw new Error(`${folder} is read from ${dir}, not installed, so it is removed there, not here`);
            // Whatever its main half started (a daemon, a watcher) keeps going until the process ends.
            if (pluginOps.has(folder)) restartFor.set(folder, 'removed');
            // A misnamed folder never loaded, so it stored nothing, and Settings asks for its data with the rest.
            REMOVE.remove(folder, { data: alsoData && !idProblem(folder) });
            return true;
        });

        PROTOCOL.reveal.answer(async ({ id }) => {
            const { shell } = require('electron');
            const { dir } = listedFolder(id);
            if (!fs.existsSync(dir)) return false;
            shell.openPath(dir);
            return true;
        });

        // Not answered at once: a plugin with a thousand notes is a thousand directory entries read in main.
        PROTOCOL.dataSize.answer(async ({ id }) => {
            // An id that never loaded has nothing stored.
            if (idProblem(id)) return { count: 0, capped: false, hidden: false };
            return DATA_RULES.count(pluginDataDir(id), { fs, path });
        });

        const refreshPluginMains = () => {
            const found = new Set();
            for (const entry of listPlugins()) {
                if (entry.error || !entry.hasMain) continue;
                found.add(entry.id);
                if (pluginOps.has(entry.id)) {
                    // Already running. If the id now names another folder, the old folder's code runs until a restart.
                    if (loadedDir.get(entry.id) !== entry.dir) restartFor.set(entry.id, 'updated');
                    continue;
                }
                loadPluginMain(entry);
            }
            for (const id of Array.from(pluginOps.keys())) {
                if (found.has(id)) continue;
                pluginOps.delete(id);
                forgetModule(loadedDir.get(id));
                loadedDir.delete(id);
            }
            for (const id of Array.from(mainErrors.keys())) if (!found.has(id)) mainErrors.delete(id);
        };

        PROTOCOL.refresh.answer(async () => {
            refreshPluginMains();
        });

        PROTOCOL.restartPending.answer(() => Array.from(restartFor, ([id, why]) => ({ id, why })));

        PROTOCOL.call.answer(async ({ plugin: pluginId, op, args }) => {
            const ops = pluginOps.get(pluginId);
            if (!ops) throw new Error(pluginId + ' has no main half');
            const fn = ops.get(op);
            if (!fn) throw new Error('unknown op ' + pluginId + '.' + op);
            return await fn(...args);
        });

        // At once: the panel is built in one pass, and a plugin arriving a tick later would rearrange the nav bar.
        PROTOCOL.list.answer(() => {
            try {
                const list = listPlugins().map((p) => ({
                    ...p,
                    mainRunning: pluginOps.has(p.id),
                    mainError: mainErrors.get(p.id) || null,
                }));
                // Logged on every panel boot, so a plugin that is not running says so where a terminal can see.
                const ok = list.filter((p) => p.source).map((p) => p.id + '@' + (p.version || '?'));
                console.log(
                    '[deckit] plugins from ' +
                        [...PLUGIN_SOURCES, PLUGIN_ROOT].join(', ') +
                        ': ' +
                        (ok.join(', ') || 'none')
                );
                for (const p of list) if (p.error) console.warn('[deckit] plugin ' + p.id + ' not loaded: ' + p.error);
                return list;
            } catch (err) {
                console.error('[deckit] could not read plugins', err);
                return [];
            }
        });

        const { read: readFile, write: writeFile } = STORE;
        const readData = (pluginId, key) => {
            try {
                return readFile(dataFile(pluginId, key));
            } catch {
                return null;
            }
        };
        const writeData = (pluginId, key, json) => writeFile(dataFile(pluginId, key), json);

        // The writer is skipped: telling it would turn its own set() into a change event it has to ignore.
        const broadcast = (sender, end, payload) => {
            const { webContents } = require('electron');
            for (const wc of webContents.getAllWebContents()) if (wc !== sender) end.send(wc, payload);
        };

        PROTOCOL.dataGet.answer(({ plugin, key }) => {
            try {
                return readData(plugin, key);
            } catch {
                return null;
            }
        });

        PROTOCOL.dataKeys.answer(({ plugin }) => {
            try {
                return fs
                    .readdirSync(pluginDataDir(plugin))
                    .filter((f) => f.endsWith('.json'))
                    .map((f) => f.slice(0, -5));
            } catch {
                return [];
            }
        });

        PROTOCOL.dataPath.answer(({ plugin, key }) => {
            try {
                return key ? dataFile(plugin, key) : pluginDataDir(plugin);
            } catch {
                return null;
            }
        });

        PROTOCOL.dataSet.answer(({ plugin, key, json }, sender) => {
            writeData(plugin, key, json);
            broadcast(sender, PROTOCOL.dataChanged, { plugin, key });
            return true;
        });

        PROTOCOL.dataRemove.answer(({ plugin, key }, sender) => {
            try {
                fs.unlinkSync(dataFile(plugin, key));
            } catch {}
            broadcast(sender, PROTOCOL.dataChanged, { plugin, key });
            return true;
        });

        /* Kept in the app's own store, so it outlives a reinstall. Only strings are kept; which are plugins
     is the panel's to work out. */
        const PLUGIN_ORDER = 'plugin-order';
        PROTOCOL.order.answer(() => {
            try {
                const ids = JSON.parse(storage.host.read(PLUGIN_ORDER) || '[]');
                return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
            } catch {
                return [];
            }
        });
        PROTOCOL.setOrder.answer(({ ids }) => {
            storage.host.write(PLUGIN_ORDER, JSON.stringify(ids.filter((id) => typeof id === 'string')));
            return true;
        });

        return { permissions, start };
    }
);
