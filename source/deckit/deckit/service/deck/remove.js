DeckitModule.define(
    'deckit/service/deck/remove',
    {
        uses: [
            'deckit/service/storage',
            'deckit/service/plugin/manifest',
            'deckit/service/deck/install',
        ],
        provides: ['remove', 'forgetData', 'forgotten', 'clearForgotten'],
        runs: 'node',
    },
    (STORAGE, MANIFEST, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');
        const FORGOTTEN = 'forgotten';

        // MARK: - Initializer
        // MARK: - Public
        // The installed plugin with this id, every copy of it. With `data`, what it stored goes too.
        function remove(id, { data = false } = {}) {
            const copies = INSTALL.installed().get(id);
            if (!copies) throw new Error('no installed plugin ' + id);
            for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
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
