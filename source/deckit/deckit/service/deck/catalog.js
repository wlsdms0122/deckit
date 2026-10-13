DeckitModule.define(
    'deckit/service/deck/catalog',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/module/version',
            'deckit/service/plugin/folder',
            'deckit/service/deck/install',
        ],
        provides: ['start', 'entries', 'plugins', 'order', 'arrange', 'refresh', 'onChange', 'sourceOf', 'manifestOf'],
        runs: 'main',
    },
    (CONFIG, HOME, STORAGE, LOG, VERSION, FOLDER, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');
        const ORDER = 'plugin-order';
        let catalogued = []; // every plugin read, loading or not
        let shipOrder = []; // the ids of what the app ships, in its order
        // plugin id -> how many times it was installed while deckit ran: a copy of the same version is new code too
        const installs = new Map();
        const listeners = new Set();

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            shipOrder = CONFIG.ship.map((folder) => FOLDER.idOf(folder));
            catalogued = list();
            for (const entry of catalogued)
                if (entry.problem) LOG.warn(`plugin ${entry.id} not loaded: ${entry.problem}`);
        }

        // Every plugin deckit reads, a source before an installed one of the same id, each with whether it loads
        // and why not, and the folders of the same id it hides.
        function entries() {
            return catalogued;
        }

        // The plugins that load, in the person's order.
        function plugins() {
            return arranged(catalogued.filter((entry) => !entry.problem));
        }

        function order() {
            return STORAGE.state.read(ORDER, []);
        }

        // The ids named take the places they held among themselves, in the order given; the rest stay put.
        function arrange(ids) {
            const now = plugins().map(({ id }) => id);
            const moved = [...new Set(ids)].filter((id) => now.includes(id));
            const slots = now.map((id, index) => (moved.includes(id) ? index : -1)).filter((index) => index >= 0);
            slots.forEach((slot, index) => (now[slot] = moved[index]));
            STORAGE.state.write(ORDER, now);
            notify();
        }

        // The folders read again. `installed` is the id of a plugin just installed.
        function refresh({ installed = null } = {}) {
            if (installed) installs.set(installed, (installs.get(installed) || 0) + 1);
            catalogued = list();
            notify();
        }

        // Told when the plugins or their order change.
        function onChange(listener) {
            listeners.add(listener);
        }

        // The text of the plugin's entry, the one file deckit runs in its sandbox.
        function sourceOf(entry) {
            const file = FOLDER.entryOf(entry.folder, entry);
            if (!file) throw new Error(`main = "${entry.main}" names no file in the plugin's folder`);
            return fs.readFileSync(file, 'utf8');
        }

        // What its manifest says, as a plugin's page and Settings see it.
        function manifestOf(entry) {
            const { id, name, version, api, main, requires, permissions, urlSchemes } = entry;
            return { id, name, version, api, main, requires, permissions, urlSchemes };
        }

        // MARK: - Private
        // A plugin that requires one that does not load does not load either.
        function list() {
            const shipped = INSTALL.shipped() || new Set();
            const entries = [];
            for (const [id, { folder, installed, manifest, problem, hides }] of found()) {
                entries.push({
                    ...manifest,
                    folder,
                    installed,
                    shipped: installed && shipped.has(id),
                    problem,
                    hides,
                    installs: installs.get(id) || 0,
                });
            }
            return withRequirements(entries);
        }

        function notify() {
            for (const listener of listeners) listener();
        }

        // A plugin's place is the person's, kept in deckit's state. One never placed goes where the app ships it,
        // and one the app does not ship goes last, by id.
        function arranged(list) {
            const placed = order();
            const rank = (id) => {
                if (placed.includes(id)) return placed.indexOf(id);
                if (shipOrder.includes(id)) return placed.length + shipOrder.indexOf(id);
                return placed.length + shipOrder.length;
            };
            return [...list].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
        }

        // By plugin id, as each folder is read: the first of an id is the one read.
        function found() {
            const out = new Map();
            for (const root of [...CONFIG.sources, HOME.plugins]) {
                for (const folder of FOLDER.pluginsIn(root)) {
                    const { manifest, problem } = FOLDER.loadable(folder);
                    if (out.has(manifest.id)) out.get(manifest.id).hides.push(folder);
                    else
                        out.set(manifest.id, {
                            folder,
                            installed: root === HOME.plugins,
                            manifest,
                            problem,
                            hides: [],
                        });
                }
            }
            return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
        }

        // A cycle fails every plugin in it; then a failure spreads to whoever requires it, until nothing changes.
        function withRequirements(entries) {
            const byId = new Map(entries.map((entry) => [entry.id, entry]));
            for (const loop of cycles(byId)) {
                for (const id of new Set(loop)) {
                    const entry = byId.get(id);
                    if (!entry.problem) entry.problem = 'requires itself: ' + loop.join(' → ');
                }
            }
            for (let changed = true; changed;) {
                changed = false;
                for (const entry of entries) {
                    if (entry.problem) continue;
                    for (const [id, want] of Object.entries(entry.requires)) {
                        const problem = requirementProblem(id, want, byId.get(id));
                        if (!problem) continue;
                        entry.problem = problem;
                        changed = true;
                        break;
                    }
                }
            }
            for (const entry of entries) {
                entry.requirements = Object.entries(entry.requires).map(([id, want]) => ({
                    id,
                    want,
                    name: byId.get(id)?.name || id,
                    ok: !requirementProblem(id, want, byId.get(id)),
                }));
            }
            return entries;
        }

        function requirementProblem(id, want, provider) {
            if (!provider) return `needs ${id}, which is not installed`;
            if (provider.problem) return `needs ${id}, which did not load`;
            if (!VERSION.satisfies(provider.version, want))
                return `needs ${id} ${want}, and ${id} is ${provider.version}`;
            return '';
        }

        function cycles(byId) {
            const state = new Map(); // id -> 'visiting' | 'done'
            const loops = [];
            const visit = (id, trail) => {
                if (state.get(id) === 'done') return;
                if (state.get(id) === 'visiting') {
                    loops.push([...trail.slice(trail.indexOf(id)), id]);
                    return;
                }
                state.set(id, 'visiting');
                for (const other of Object.keys(byId.get(id).requires))
                    if (byId.has(other)) visit(other, [...trail, id]);
                state.set(id, 'done');
            };
            for (const id of byId.keys()) visit(id, []);
            return loops;
        }

        return { start, entries, plugins, order, arrange, refresh, onChange, sourceOf, manifestOf };
    }
);
