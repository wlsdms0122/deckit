DeckitModule.define(
    'deckit/service/plugin/package/folder',
    {
        uses: ['deckit/service/plugin/package/manifest'],
        provides: ['idOf', 'loadable', 'entryOf'],
        runs: 'node',
    },
    (MANIFEST) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // The id a plugin folder's manifest gives, whatever the folder is called, or '' when it gives none.
        function idOf(folder) {
            return MANIFEST.read(textOf(folder) ?? '', '').manifest.id;
        }

        // Whether a folder is a plugin deckit loads: { manifest, problem }, the manifest given back with a problem too.
        // A manifest that names no id is shown by the folder's name.
        function loadable(folder) {
            const name = path.basename(path.resolve(folder));
            const text = textOf(folder);
            if (text === null)
                return { manifest: MANIFEST.read('', name).manifest, problem: `no ${MANIFEST.FILE} in ${folder}` };
            const { manifest, problem } = MANIFEST.read(text, name);
            if (problem) return { manifest, problem };
            if (!entryOf(folder, manifest))
                return { manifest, problem: `main = "${manifest.main}" names no file in the plugin's folder` };
            return { manifest, problem: '' };
        }

        // Where the entry a manifest names really is, or null when that is not a file inside the folder.
        function entryOf(folder, manifest) {
            try {
                const root = fs.realpathSync(folder);
                const file = fs.realpathSync(path.resolve(root, manifest.main));
                const inside = path.relative(root, file);
                if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return null;
                return fs.statSync(file).isFile() ? file : null;
            } catch {
                return null;
            }
        }

        // MARK: - Private
        function textOf(folder) {
            const file = path.join(folder, MANIFEST.FILE);
            return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        }

        return { idOf, loadable, entryOf };
    }
);
