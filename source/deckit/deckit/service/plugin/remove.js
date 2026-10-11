DeckitModule.define(
    'deckit/service/plugin/remove',
    {
        uses: [
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/plugin/model/manifest',
            'deckit/service/plugin/install',
        ],
        provides: ['remove'],
        runs: 'node',
    },
    (home, storage, MANIFEST, INSTALL) => {
        const fs = require('fs');
        const path = require('path');

        /* Any installed folder may be removed, a misnamed one included, but only by its exact name on disk,
     so neither .package nor a plugin named in another case is reached. */
        const remove = (folder, { data = false } = {}) => {
            const name = String(folder || '');
            if (!INSTALL.folders().includes(name)) throw new Error('no installed plugin named ' + name);
            const why = data ? MANIFEST.idProblem(name) : '';
            if (why) throw new Error(`${name} never stored anything (${why}): remove it without --data`);
            fs.rmSync(path.join(home.pluginInstall.root, name), { recursive: true, force: true });
            if (data) fs.rmSync(storage.folderOf(name), { recursive: true, force: true });
            return { data };
        };

        return { remove };
    }
);
