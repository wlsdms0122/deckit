DeckitModule.define(
    'deck/service/deck/install',
    {
        uses: ['deck/config', 'deck/service/home', 'deck/service/mod/folder'],
        provides: ['installed', 'installable', 'install', 'shipped', 'installShipped', 'notInstalled'],
        runs: 'node',
    },
    (CONFIG, HOME, FOLDER) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const notInstalledById = new Map(); // mod id -> { folder, problem }: what the app ships that did not install

        // MARK: - Initializer
        // MARK: - Public
        // The installed copies of each mod, by id, whatever their folders are named, in the order the catalog reads
        // them: the first is the one read.
        function installed() {
            const copies = new Map();
            for (const folder of FOLDER.modsIn(HOME.mods)) {
                const id = FOLDER.idOf(folder);
                copies.set(id, [...(copies.get(id) || []), folder]);
            }
            return copies;
        }

        // The manifest of a folder that can be installed, or a throw that says why not: a mod deck would not
        // load, or a folder that holds the installed copy or is held by it (copying would take the source with it).
        // `refuse(manifest)` adds the caller's own reason, or ''.
        function installable(from, refuse = () => '') {
            const { manifest, problem } = FOLDER.loadable(from);
            if (problem) throw new Error(problem);
            const to = path.join(HOME.mods, manifest.id);
            const copies = installed().get(manifest.id) || [];
            if (copies.some((copy) => path.resolve(from) === path.resolve(copy)))
                throw new Error('that folder is already the installed one');
            if ([...copies, to].some((installedAt) => inside(installedAt, from) || inside(from, installedAt)))
                throw new Error('that folder is inside the installed one, or holds it');
            if (fs.existsSync(to) && !copies.includes(to))
                throw new Error(`${to}, where ${manifest.id} would be installed, holds another folder`);
            const refused = refuse(manifest);
            if (refused) throw new Error(refused);
            return manifest;
        }

        // Installed as mods/<id>, every copy before it taken away wherever it was, so a file the new version dropped
        // is not left to load. Only a whole staged copy takes the old one's place. Answers the manifest.
        function install(from, refuse) {
            const manifest = installable(from, refuse);
            const id = manifest.id;
            const staged = path.join(HOME.staging, id);
            fs.rmSync(staged, { recursive: true, force: true });
            fs.mkdirSync(HOME.staging, { recursive: true });
            fs.cpSync(from, staged, { recursive: true });
            fs.mkdirSync(HOME.mods, { recursive: true });
            for (const copy of installed().get(id) || []) fs.rmSync(copy, { recursive: true, force: true });
            fs.renameSync(staged, path.join(HOME.mods, id));
            fs.rmSync(HOME.staging, { recursive: true, force: true });
            return manifest;
        }

        // The ids the app shipped at the last install of what it ships, or null before the first.
        function shipped() {
            if (!fs.existsSync(HOME.shipped)) return null;
            return new Set(fs.readFileSync(HOME.shipped, 'utf8').split('\n').filter(Boolean));
        }

        // What the app ships (CONFIG.ship) installed by one rule: a mod it shipped before and that is not
        // installed now was removed by the person, and stays out; the rest is installed. Removals are recorded
        // nowhere else. `only` installs those ids whatever was decided before, and leaves the others as they are.
        //
        // One that does not install fails alone, and is not recorded as shipped unless a copy of it is installed: the
        // next start tries it again rather than take it for removed. A second folder shipped with an id is ignored.
        function installShipped({ only = null } = {}) {
            const byId = new Map();
            const outcomes = [];
            for (const folder of CONFIG.ship) {
                const id = FOLDER.idOf(folder);
                if (!byId.has(id)) byId.set(id, folder);
                else outcomes.push({ id, outcome: 'ignored', version: null, problem: `${folder} has its id too` });
            }
            for (const id of only || []) if (!byId.has(id)) throw new Error(`not a mod the app ships: ${id}`);

            const before = shipped();
            const copies = installed();
            const take = only ? [...only] : [];
            if (!only) {
                notInstalledById.clear();
                for (const id of byId.keys()) {
                    if (before?.has(id) && !copies.has(id)) outcomes.push({ id, outcome: 'left out', version: null });
                    else take.push(id);
                }
                for (const id of before || []) {
                    if (byId.has(id) || !copies.has(id)) continue;
                    for (const copy of copies.get(id)) fs.rmSync(copy, { recursive: true, force: true });
                    outcomes.push({ id, outcome: 'dropped', version: null });
                }
            }
            for (const id of take) {
                notInstalledById.delete(id);
                try {
                    const manifest = install(byId.get(id));
                    outcomes.push({ id, outcome: 'installed', version: manifest.version });
                } catch (error) {
                    notInstalledById.set(id, { folder: byId.get(id), problem: error.message });
                    outcomes.push({ id, outcome: 'failed', version: null, problem: error.message });
                }
            }

            // A left out id stays on the list, so its absence keeps meaning it was removed.
            const now = installed();
            const list = (only ? [...new Set([...(before || []), ...only])].sort() : [...byId.keys()]).filter(
                (id) => !notInstalledById.has(id) || now.has(id)
            );
            fs.mkdirSync(HOME.mods, { recursive: true });
            fs.writeFileSync(HOME.shipped + '.new', list.map((id) => id + '\n').join(''));
            fs.renameSync(HOME.shipped + '.new', HOME.shipped);
            return outcomes;
        }

        // What the app ships that did not install at this start, and why: { folder, problem } by mod id.
        function notInstalled() {
            return notInstalledById;
        }

        // MARK: - Private
        function inside(parent, child) {
            const relative = path.relative(path.resolve(parent), path.resolve(child));
            return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
        }

        return { installed, installable, install, shipped, installShipped, notInstalled };
    }
);
