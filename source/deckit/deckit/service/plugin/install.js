DeckitModule.define(
    'deckit/service/plugin/install',
    {
        uses: ['deckit/service/home', 'deckit/service/plugin/model/manifest', 'deckit/service/plugin/folder'],
        provides: ['folders', 'install', 'copyProblem', 'shipped', 'installShipped'],
        runs: 'node',
    },
    (home, MANIFEST, FOLDER) => {
        const fs = require('fs');
        const path = require('path');
        const { root: ROOT, staging: STAGING, packageList: LIST } = home.pluginInstall;

        /* Names exactly as on disk, so on a disk that ignores case a name matching only in another case is no
     plugin's. What the install keeps beside the folders begins with a dot (.package). */
        const folders = (root = ROOT) => {
            let names = [];
            try {
                names = fs.readdirSync(root);
            } catch {
                return [];
            }
            // stat, not the entry's own type: a plugin folder may be a link to one.
            const folder = (name) => {
                try {
                    return fs.statSync(path.join(root, name)).isDirectory();
                } catch {
                    return false;
                }
            };
            return names.filter((name) => !name.startsWith('.') && folder(name)).sort();
        };

        const inside = (parent, child) => {
            const rel = path.relative(path.resolve(parent), path.resolve(child));
            return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
        };
        // Either holding the other would copy into the source, or removing the old one would take the source.
        const copyProblem = (from, id) => {
            const dest = path.join(ROOT, id);
            if (path.resolve(from) === path.resolve(dest)) return 'that folder is already the installed one';
            if (inside(dest, from) || inside(from, dest)) return 'that folder is inside the installed one, or holds it';
            return '';
        };

        /* The folder is replaced outright, so a file the new version dropped is not left to load. Only a
     finished staged copy takes the old one's place. */
        const install = (from, id) => {
            const why = copyProblem(from, id);
            if (why) throw new Error(why);
            const staged = path.join(STAGING, id);
            fs.rmSync(staged, { recursive: true, force: true });
            fs.mkdirSync(STAGING, { recursive: true });
            fs.cpSync(from, staged, { recursive: true });
            fs.mkdirSync(ROOT, { recursive: true });
            fs.rmSync(path.join(ROOT, id), { recursive: true, force: true });
            fs.renameSync(staged, path.join(ROOT, id));
            try {
                fs.rmdirSync(STAGING);
            } catch {}
        };

        // null before the first install.
        const shipped = () => {
            try {
                return new Set(fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean));
            } catch {
                return null;
            }
        };

        /* Removals are not recorded anywhere: a removed plugin is one shipped at the last install
     (packageList) that is not installed now. `only` installs those ids regardless, and leaves the
     rest of the list as it was, since the rest were not looked at. */
        const installShipped = (folders, { only = null } = {}) => {
            const byId = new Map();
            for (const dir of folders) {
                const id = path.basename(path.resolve(dir));
                if (byId.has(id)) throw new Error(`two plugins named ${id}: ${byId.get(id)} and ${dir}`);
                byId.set(id, dir);
            }
            for (const id of only || []) if (!byId.has(id)) throw new Error(`not a plugin of this product: ${id}`);

            const before = shipped();
            const installedNow = (id) => fs.existsSync(path.join(ROOT, id));
            const outcomes = [];
            const take = [];
            if (only) take.push(...only);
            else {
                for (const id of byId.keys()) {
                    if (before?.has(id) && !installedNow(id)) outcomes.push({ id, outcome: 'left out', version: null });
                    else take.push(id);
                }
            }

            const versions = new Map(
                take.map((id) => {
                    const { manifest, problem } = FOLDER.loadable(byId.get(id));
                    if (problem) throw new Error(`${byId.get(id)}: ${problem}`);
                    return [id, manifest.version];
                })
            );

            if (!only) {
                for (const id of before || []) {
                    if (byId.has(id) || !installedNow(id)) continue;
                    fs.rmSync(path.join(ROOT, id), { recursive: true, force: true });
                    outcomes.push({ id, outcome: 'dropped', version: null });
                }
            }
            for (const id of take) {
                install(byId.get(id), id);
                outcomes.push({ id, outcome: 'installed', version: versions.get(id) });
            }

            /* A left out id stays in the list, so its absence keeps meaning it was removed. Written aside and
       moved, so the list is never half written. */
            const list = only ? [...new Set([...(before || []), ...only])].sort() : [...byId.keys()];
            fs.mkdirSync(ROOT, { recursive: true });
            fs.writeFileSync(LIST + '.new', list.map((id) => id + '\n').join(''));
            fs.renameSync(LIST + '.new', LIST);
            return outcomes;
        };

        return Object.freeze({ folders, install, copyProblem, shipped, installShipped });
    }
);
