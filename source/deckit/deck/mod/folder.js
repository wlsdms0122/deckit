DeckitModule.define(
    'deck/mod/folder',
    {
        uses: ['deck/mod/manifest'],
        provides: ['modsIn', 'idOf', 'loadable', 'entryOf', 'fileIn'],
        runs: 'node',
    },
    (MANIFEST) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // The mod folders in `root`, in the order of their names exactly as on disk: on a disk that ignores case, a
        // name matching only in another case is no mod's. A folder with no manifest is not a broken mod but no
        // mod, and a dot name (.shipped) is deck's own.
        function modsIn(root) {
            if (!fs.existsSync(root)) return [];
            return fs
                .readdirSync(root)
                .filter((name) => !name.startsWith('.'))
                .sort()
                .map((name) => path.join(root, name))
                .filter((folder) => isFolder(folder) && fs.existsSync(path.join(folder, MANIFEST.FILE)));
        }

        // Who the mod in a folder is: the id its manifest gives, or the folder's name when it gives none.
        function idOf(folder) {
            return loadable(folder).manifest.id;
        }

        // Whether a folder is a mod deck loads: { manifest, problem }, the manifest given back with a problem too.
        // A manifest that names no id is shown by the folder's name.
        function loadable(folder) {
            const name = path.basename(path.resolve(folder));
            const text = textOf(folder);
            if (text === null)
                return { manifest: MANIFEST.read('', name).manifest, problem: `no ${MANIFEST.FILE} in ${folder}` };
            const { manifest, problem } = MANIFEST.read(text, name);
            if (problem) return { manifest, problem };
            if (!entryOf(folder, manifest))
                return { manifest, problem: `main = "${manifest.main}" names no file in the mod's folder` };
            return { manifest, problem: '' };
        }

        // Where the entry a manifest names really is, or null when that is no file inside the folder.
        function entryOf(folder, manifest) {
            return fileIn(folder, manifest.main)?.file || null;
        }

        // The file a path names inside a mod's folder, where it really is: { file, relative }, `relative` its "/"
        // separated path from the folder. Null for a path that is no file, or that leads out of the folder, by a link
        // too.
        function fileIn(folder, given) {
            try {
                const root = fs.realpathSync(folder);
                const file = fs.realpathSync(path.resolve(root, String(given)));
                const inside = path.relative(root, file);
                if (!inside || inside.split(path.sep)[0] === '..' || path.isAbsolute(inside)) return null;
                if (!fs.statSync(file).isFile()) return null;
                return { file, relative: inside.split(path.sep).join('/') };
            } catch {
                return null;
            }
        }

        // MARK: - Private
        // stat, not the entry's own type: a mod folder may be a link to one.
        function isFolder(file) {
            return fs.existsSync(file) && fs.statSync(file).isDirectory();
        }

        function textOf(folder) {
            const file = path.join(folder, MANIFEST.FILE);
            return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        }

        return { modsIn, idOf, loadable, entryOf, fileIn };
    }
);
