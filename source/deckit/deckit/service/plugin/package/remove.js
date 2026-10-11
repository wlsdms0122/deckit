DeckitModule.define(
    'deckit/service/plugin/package/remove',
    {
        uses: [
            'deckit/service/home',
            'deckit/service/storage',
            'deckit/service/plugin/package/manifest',
            'deckit/service/plugin/package/install',
        ],
        provides: ['remove', 'forgotten', 'clearForgotten'],
        runs: 'node',
    },
    (HOME, STORAGE, MANIFEST, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const FORGOTTEN = 'forgotten';

        // MARK: - Initializer
        // MARK: - Public
        // An installed folder, by its exact name on disk, so neither .shipped nor a name in another case is
        // reached. With `data`, what the plugin stored goes too. A folder whose name is no plugin id never
        // loaded, so it stored nothing.
        function remove(name, { data = false } = {}) {
            if (!INSTALL.folders().includes(name)) throw new Error('no installed plugin named ' + name);
            fs.rmSync(path.join(HOME.plugins, name), { recursive: true, force: true });
            if (!data || MANIFEST.idProblem(name)) return { data: false };
            STORAGE.forget(name);
            // Its pages' storage and its web sessions are the app's sessions', which main clears at its next start.
            STORAGE.state.write(FORGOTTEN, [...new Set([...forgotten(), name])]);
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
