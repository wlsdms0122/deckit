DeckitModule.define(
    'deckit/service/plugin/package/folder',
    {
        uses: ['deckit/service/plugin/package/manifest', 'deckit/service/plugin/package/model/permission'],
        provides: ['idOf', 'loadable'],
        runs: 'node',
    },
    (MANIFEST, PERMISSION) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // A plugin's id is its folder's name.
        function idOf(folder) {
            return path.basename(path.resolve(folder));
        }

        // Whether a folder is a plugin deckit loads: { manifest, problem }, the manifest given back with a problem too.
        function loadable(folder) {
            const id = idOf(folder);
            const file = path.join(folder, MANIFEST.FILE);
            if (!fs.existsSync(file))
                return { manifest: MANIFEST.read('', id).manifest, problem: `no ${MANIFEST.FILE} in ${folder}` };
            const { manifest, problem } = MANIFEST.read(fs.readFileSync(file, 'utf8'), id);
            if (problem) return { manifest, problem };
            if (!fs.existsSync(path.join(folder, 'page.js'))) return { manifest, problem: 'no page.js in the folder' };
            const hasMain = fs.existsSync(path.join(folder, 'main.js'));
            const asksMain = manifest.permissions.some(({ id: permission }) => permission === PERMISSION.MAIN_PROCESS);
            if (hasMain && !asksMain) {
                return {
                    manifest,
                    problem: `main.js runs in the app's own process; ${MANIFEST.FILE} has to ask for it, with why, as "${PERMISSION.MAIN_PROCESS}" = "…" under [permissions]`,
                };
            }
            if (asksMain && !hasMain)
                return {
                    manifest,
                    problem: `${MANIFEST.FILE} asks for ${PERMISSION.MAIN_PROCESS} but there is no main.js in the folder`,
                };
            return { manifest, problem: '' };
        }

        // MARK: - Private

        return { idOf, loadable };
    }
);
