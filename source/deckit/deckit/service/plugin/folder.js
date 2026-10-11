DeckitModule.define(
    'deckit/service/plugin/folder',
    {
        uses: ['deckit/service/plugin/model/manifest'],
        provides: ['loadable'],
        runs: 'node',
    },
    (MANIFEST) => {
        const fs = require('fs');
        const path = require('path');
        const { FILE, MAIN_PERMISSION } = MANIFEST;

        // The manifest comes back even with a problem, so a row can still show the name.
        const loadable = (dir) => {
            const id = path.basename(path.resolve(dir));
            let text = '';
            try {
                text = fs.readFileSync(path.join(dir, FILE), 'utf8');
            } catch {
                return { manifest: MANIFEST.read('', id).manifest, problem: `no ${FILE} in ${dir}` };
            }
            const { manifest, problem } = MANIFEST.read(text, id);
            if (problem) return { manifest, problem };
            const api = MANIFEST.apiProblem(manifest.api);
            if (api) return { manifest, problem: api };
            if (!fs.existsSync(path.join(dir, 'view.js'))) return { manifest, problem: 'no view.js in the folder' };
            const hasMain = fs.existsSync(path.join(dir, 'main.js'));
            const asksMain = manifest.permissions.some((p) => p.id === MAIN_PERMISSION);
            if (hasMain && !asksMain)
                return {
                    manifest,
                    problem: `main.js runs in the app's own process; ${FILE} has to ask for it, with why, as ${MAIN_PERMISSION} = "…" under [permissions]`,
                };
            if (asksMain && !hasMain)
                return {
                    manifest,
                    problem: `${FILE} asks for ${MAIN_PERMISSION} but there is no main.js in the folder`,
                };
            return { manifest, problem: '' };
        };

        return { loadable };
    }
);
