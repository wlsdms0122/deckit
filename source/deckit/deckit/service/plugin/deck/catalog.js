DeckitModule.define(
    'deckit/service/plugin/deck/catalog',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/module/version',
            'deckit/service/plugin/package/manifest',
            'deckit/service/plugin/package/folder',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/package/model/permission',
            'deckit/service/log/main',
        ],
        provides: ['list', 'sourceOf'],
        runs: 'main',
    },
    (CONFIG, HOME, VERSION, MANIFEST, FOLDER, INSTALL, PERMISSION, LOG) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // Every plugin folder deckit reads, a source before an installed one of the same id, each with whether
        // it loads and why not. A plugin that requires one that does not load does not load either.
        function list() {
            const shipped = INSTALL.shipped() || new Set();
            const entries = [];
            for (const [id, { folder, installed }] of found()) {
                // A folder with no manifest is not a broken plugin but no plugin.
                if (!fs.existsSync(path.join(folder, MANIFEST.FILE))) continue;
                const { manifest, problem } = FOLDER.loadable(folder);
                entries.push({
                    ...manifest,
                    folder,
                    installed,
                    shipped: installed && shipped.has(id),
                    hasMain: manifest.permissions.some(({ id: permission }) => permission === PERMISSION.MAIN_PROCESS),
                    problem,
                });
            }
            return withRequirements(entries);
        }

        // page/ first, in path order, then page.js, as one body: the same text on every machine.
        function sourceOf(entry) {
            const parts = path.join(entry.folder, 'page');
            return [
                ...scripts(parts).map(
                    (file) => `/* page/${file} */\n` + fs.readFileSync(path.join(parts, file), 'utf8')
                ),
                '/* page.js */\n' + fs.readFileSync(path.join(entry.folder, 'page.js'), 'utf8'),
            ].join('\n;\n');
        }

        // MARK: - Private
        function found() {
            const out = new Map();
            for (const root of [...CONFIG.sources, HOME.plugins]) {
                for (const name of INSTALL.folders(root)) {
                    const folder = path.join(root, name);
                    if (out.has(name)) {
                        LOG.warn(`${folder} is hidden by ${out.get(name).folder}`);
                        continue;
                    }
                    out.set(name, { folder, installed: root === HOME.plugins });
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

        function scripts(folder, relative = '') {
            const here = path.join(folder, relative);
            if (!fs.existsSync(here)) return [];
            return fs
                .readdirSync(here, { withFileTypes: true })
                .flatMap((entry) => {
                    const next = relative ? path.join(relative, entry.name) : entry.name;
                    if (entry.isDirectory()) return scripts(folder, next);
                    return entry.name.endsWith('.js') ? [next] : [];
                })
                .sort();
        }

        return { list, sourceOf };
    }
);
