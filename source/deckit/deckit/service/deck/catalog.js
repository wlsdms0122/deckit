DeckitModule.define(
    'deckit/service/deck/catalog',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/module/version',
            'deckit/service/mod/folder',
            'deckit/service/deck/install',
        ],
        provides: ['start', 'found', 'mods', 'order', 'arrange', 'refresh', 'onChange', 'sourceOf'],
        runs: 'main',
    },
    (CONFIG, HOME, STORAGE, LOG, VERSION, FOLDER, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');
        const ORDER = 'mod-order';
        let catalogued = []; // every mod read, loading or not
        let shipOrder = []; // the ids of what the app ships, in its order
        const installs = new Map(); // mod id -> how many times it was installed while deckit ran
        const listeners = new Set();

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            shipOrder = CONFIG.ship.map((folder) => FOLDER.idOf(folder));
            catalogued = list();
            for (const mod of catalogued) if (mod.problem) LOG.warn(`mod ${mod.id} not loaded: ${mod.problem}`);
        }

        // Every mod deckit reads, a source before an installed one of the same id, each with whether it loads
        // and why not, and the folders of the same id it hides.
        function found() {
            return catalogued;
        }

        // The mods that load, in the person's order.
        function mods() {
            return arranged(catalogued.filter((mod) => !mod.problem));
        }

        function order() {
            return STORAGE.state.read(ORDER, []);
        }

        // The ids named take the places they held among themselves, in the order given; the rest stay put.
        function arrange(ids) {
            const next = mods().map(({ id }) => id);
            const moved = [...new Set(ids)].filter((id) => next.includes(id));
            const places = next.map((id, index) => (moved.includes(id) ? index : -1)).filter((index) => index >= 0);
            places.forEach((place, index) => (next[place] = moved[index]));
            STORAGE.state.write(ORDER, next);
            notify();
        }

        // The folders read again. `installed` is the id of a mod just installed.
        function refresh({ installed = null } = {}) {
            if (installed) installs.set(installed, (installs.get(installed) || 0) + 1);
            catalogued = list();
            notify();
        }

        // Told when the mods or their order change.
        function onChange(listener) {
            listeners.add(listener);
        }

        // The text of the mod's entry, the one file deckit runs in its sandbox.
        function sourceOf(mod) {
            const file = FOLDER.entryOf(mod.folder, mod);
            if (!file) throw new Error(`main = "${mod.main}" names no file in the mod's folder`);
            return fs.readFileSync(file, 'utf8');
        }

        // MARK: - Private
        // A mod that requires one that does not load does not load either. Two reads of a mod with one
        // `revision` are the same code: a copy installed again, even of the same version, is not. What the app ships
        // and did not install, with no copy to read, is read where the app ships it, and does not load.
        function list() {
            const shipped = INSTALL.shipped() || new Set();
            const read = [];
            const folders = foldersById();
            for (const [id, { folder, problem }] of INSTALL.notInstalled()) {
                if (folders.has(id)) continue;
                const { manifest } = FOLDER.loadable(folder);
                folders.set(id, {
                    folder,
                    manifest,
                    problem: 'did not install: ' + problem,
                    hides: [],
                    notInstalled: true,
                });
            }
            for (const [id, { folder, installed = false, manifest, problem, hides, notInstalled }] of folders) {
                const revision = JSON.stringify([
                    folder,
                    manifest.version,
                    installs.get(id) || 0,
                    manifest.permissions,
                ]);
                read.push({
                    ...manifest,
                    folder,
                    installed,
                    shipped: !!notInstalled || (installed && shipped.has(id)),
                    problem,
                    hides,
                    revision,
                });
            }
            return withRequirements(read);
        }

        function notify() {
            for (const listener of listeners) listener();
        }

        // A mod's place is the person's, kept in deckit's state. One never placed goes where the app ships it,
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

        // By mod id, as each folder is read: the first of an id is the one read.
        function foldersById() {
            const out = new Map();
            for (const root of [...CONFIG.sources, HOME.mods]) {
                for (const folder of FOLDER.modsIn(root)) {
                    const { manifest, problem } = FOLDER.loadable(folder);
                    if (out.has(manifest.id)) out.get(manifest.id).hides.push(folder);
                    else
                        out.set(manifest.id, {
                            folder,
                            installed: root === HOME.mods,
                            manifest,
                            problem,
                            hides: [],
                        });
                }
            }
            return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
        }

        // A cycle fails every mod in it; then a failure spreads to whoever requires it, until nothing changes.
        function withRequirements(read) {
            const byId = new Map(read.map((mod) => [mod.id, mod]));
            for (const loop of cycles(byId)) {
                for (const id of new Set(loop)) {
                    const mod = byId.get(id);
                    if (!mod.problem) mod.problem = 'requires itself: ' + loop.join(' → ');
                }
            }
            for (let changed = true; changed; ) {
                changed = false;
                for (const mod of read) {
                    if (mod.problem) continue;
                    for (const [id, want] of Object.entries(mod.requires)) {
                        const problem = requirementProblem(id, want, byId.get(id));
                        if (!problem) continue;
                        mod.problem = problem;
                        changed = true;
                        break;
                    }
                }
            }
            for (const mod of read) {
                mod.requirements = Object.entries(mod.requires).map(([id, want]) => ({
                    id,
                    want,
                    name: byId.get(id)?.name || id,
                    ok: !requirementProblem(id, want, byId.get(id)),
                }));
            }
            return read;
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

        return { start, found, mods, order, arrange, refresh, onChange, sourceOf };
    }
);
