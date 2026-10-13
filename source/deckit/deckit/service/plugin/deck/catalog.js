DeckitModule.define(
    'deckit/service/plugin/deck/catalog',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/module/version',
            'deckit/service/plugin/package/folder',
            'deckit/service/plugin/package/install',
        ],
        provides: ['list', 'sourceOf'],
        runs: 'main',
    },
    (CONFIG, HOME, VERSION, FOLDER, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');

        // MARK: - Initializer
        // MARK: - Public
        // Every plugin deckit reads, a source before an installed one of the same id, each with whether it loads
        // and why not, and the folders of the same id it hides. A plugin that requires one that does not load does not
        // load either.
        function list() {
            const shipped = INSTALL.shipped() || new Set();
            const entries = [];
            for (const [id, { folder, installed, manifest, problem, hides }] of found()) {
                entries.push({ ...manifest, folder, installed, shipped: installed && shipped.has(id), problem, hides });
            }
            return withRequirements(entries);
        }

        // The text of the plugin's entry, the one file deckit runs in its sandbox.
        function sourceOf(entry) {
            const file = FOLDER.entryOf(entry.folder, entry);
            if (!file) throw new Error(`main = "${entry.main}" names no file in the plugin's folder`);
            return fs.readFileSync(file, 'utf8');
        }

        // MARK: - Private
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
            for (let changed = true; changed; ) {
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

        return { list, sourceOf };
    }
);
