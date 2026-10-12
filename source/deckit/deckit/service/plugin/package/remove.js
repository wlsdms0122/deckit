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
        provides: ['remove', 'forgetData', 'forgotten', 'clearForgotten'],
        runs: 'node',
    },
    (HOME, STORAGE, MANIFEST, INSTALL, FOLDER) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const FORGOTTEN = 'forgotten';

        // MARK: - Initializer
        // MARK: - Public
        // The installed plugin with this id, wherever deckit keeps it. With `data`, what it stored goes too.
        function remove(id, { data = false } = {}) {
            const name = INSTALL.folders().find((name) => FOLDER.idOf(path.join(HOME.plugins, name)) === id);
            if (!name) throw new Error('no installed plugin ' + id);
            fs.rmSync(path.join(HOME.plugins, name), { recursive: true, force: true });
            return { data: data && forgetData(id) };
        }

        // What a plugin stored, taken away: whether there was any to take. An id that is no plugin id never loaded, so
        // it stored nothing.
        function forgetData(id) {
            if (MANIFEST.idProblem(id)) return false;
            STORAGE.forget(id);
            // Its pages' storage and its web sessions are the app's sessions', which main clears at its next start.
            STORAGE.state.write(FORGOTTEN, [...new Set([...forgotten(), id])]);
            return true;
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

        return { remove, forgetData, forgotten, clearForgotten };
    }
);
