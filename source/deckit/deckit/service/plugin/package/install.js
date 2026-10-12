DeckitModule.define(
    'deckit/service/plugin/package/install',
    {
        uses: ['deckit/config', 'deckit/service/home', 'deckit/service/plugin/package/folder'],
        provides: ['folders', 'installable', 'install', 'shipped', 'installShipped'],
        runs: 'node',
    },
    (CONFIG, HOME, FOLDER) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // The plugin folders in `root`, by their names exactly as on disk: on a disk that ignores case, a name
        // matching only in another case is no plugin's. A dot name (.shipped) is deckit's own.
        function folders(root = HOME.plugins) {
            if (!fs.existsSync(root)) return [];
            return fs
                .readdirSync(root)
                .filter((name) => !name.startsWith('.') && isFolder(path.join(root, name)))
                .sort();
        }

        // The manifest of a folder that can be installed, or a throw that says why not: a plugin deckit would not
        // load, or a folder that holds the installed copy or is held by it (copying would take the source with it).
        // `refuse(manifest)` adds the caller's own reason, or ''.
        function installable(from, refuse = () => '') {
            const { manifest, problem } = FOLDER.loadable(from);
            if (problem) throw new Error(problem);
            const to = path.join(HOME.plugins, manifest.id);
            if (path.resolve(from) === path.resolve(to)) throw new Error('that folder is already the installed one');
            if (inside(to, from) || inside(from, to))
                throw new Error('that folder is inside the installed one, or holds it');
            const refused = refuse(manifest);
            if (refused) throw new Error(refused);
            return manifest;
        }

        // Installed as plugins/<id>, replaced outright, so a file the new version dropped is not left to load. Only a
        // whole staged copy takes the old one's place. Answers the manifest.
        function install(from, refuse) {
            const manifest = installable(from, refuse);
            const id = manifest.id;
            const staged = path.join(HOME.staging, id);
            fs.rmSync(staged, { recursive: true, force: true });
            fs.mkdirSync(HOME.staging, { recursive: true });
            fs.cpSync(from, staged, { recursive: true });
            fs.mkdirSync(HOME.plugins, { recursive: true });
            fs.rmSync(path.join(HOME.plugins, id), { recursive: true, force: true });
            fs.renameSync(staged, path.join(HOME.plugins, id));
            fs.rmSync(HOME.staging, { recursive: true, force: true });
            return manifest;
        }

        // The ids the app shipped at the last install of what it ships, or null before the first.
        function shipped() {
            if (!fs.existsSync(HOME.shipped)) return null;
            return new Set(fs.readFileSync(HOME.shipped, 'utf8').split('\n').filter(Boolean));
        }

        // What the app ships (CONFIG.ship) installed by one rule: a plugin it shipped before and that is not
        // installed now was removed by the person, and stays out; the rest is installed. Removals are recorded
        // nowhere else. `only` installs those ids whatever was decided before, and leaves the others as they are.
        function installShipped({ only = null } = {}) {
            const byId = new Map();
            for (const folder of CONFIG.ship) {
                const id = FOLDER.idOf(folder);
                if (byId.has(id)) throw new Error(`two plugins named ${id}: ${byId.get(id)} and ${folder}`);
                byId.set(id, folder);
            }
            for (const id of only || []) if (!byId.has(id)) throw new Error(`not a plugin the app ships: ${id}`);

            const before = shipped();
            const installed = (id) => fs.existsSync(path.join(HOME.plugins, id));
            const outcomes = [];
            const take = only ? [...only] : [];
            if (!only) {
                for (const id of byId.keys()) {
                    if (before?.has(id) && !installed(id)) outcomes.push({ id, outcome: 'left out', version: null });
                    else take.push(id);
                }
                for (const id of before || []) {
                    if (byId.has(id) || !installed(id)) continue;
                    fs.rmSync(path.join(HOME.plugins, id), { recursive: true, force: true });
                    outcomes.push({ id, outcome: 'dropped', version: null });
                }
            }
            for (const id of take) {
                let manifest;
                try {
                    manifest = install(byId.get(id));
                } catch (error) {
                    throw new Error(`${byId.get(id)}: ${error.message}`);
                }
                outcomes.push({ id, outcome: 'installed', version: manifest.version });
            }

            // A left out id stays on the list, so its absence keeps meaning it was removed.
            const list = only ? [...new Set([...(before || []), ...only])].sort() : [...byId.keys()];
            fs.mkdirSync(HOME.plugins, { recursive: true });
            fs.writeFileSync(HOME.shipped + '.new', list.map((id) => id + '\n').join(''));
            fs.renameSync(HOME.shipped + '.new', HOME.shipped);
            return outcomes;
        }

        // MARK: - Private
        // stat, not the entry's own type: a plugin folder may be a link to one.
        function isFolder(file) {
            return fs.existsSync(file) && fs.statSync(file).isDirectory();
        }

        function inside(parent, child) {
            const relative = path.relative(path.resolve(parent), path.resolve(child));
            return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
        }

        return { folders, installable, install, shipped, installShipped };
    }
);
