DeckitModule.define(
    'deckit/service/plugin/package/remove',
    {
        uses: [
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/plugin/package/manifest',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/package/folder',
        ],
        provides: ['remove', 'forgotten', 'clearForgotten'],
        runs: 'node',
    },
    (HOME, STORAGE, MANIFEST, INSTALL, FOLDER) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const FORGOTTEN = 'forgotten';

        // MARK: - Initializer
        // MARK: - Public
        // The installed plugin with this id, wherever deckit keeps it. With `data`, what it stored goes too. An id
        // that is no plugin id never loaded, so it stored nothing.
        function remove(id, { data = false } = {}) {
            const name = INSTALL.folders().find((name) => FOLDER.idOf(path.join(HOME.plugins, name)) === id);
            if (!name) throw new Error('no installed plugin ' + id);
            fs.rmSync(path.join(HOME.plugins, name), { recursive: true, force: true });
            if (!data || MANIFEST.idProblem(id)) return { data: false };
            STORAGE.forget(id);
            // Its pages' storage and its web sessions are the app's sessions', which main clears at its next start.
            STORAGE.state.write(FORGOTTEN, [...new Set([...forgotten(), id])]);
            return { data: true };
        }

        function forgotten() {
            return STORAGE.state.read(FORGOTTEN, []);
        }

        function clearForgotten(pluginId) {
            STORAGE.state.write(
                FORGOTTEN,
                forgotten().filter((id) => id !== pluginId)
            );
        }

        // MARK: - Private

        return { remove, forgotten, clearForgotten };
    }
);
