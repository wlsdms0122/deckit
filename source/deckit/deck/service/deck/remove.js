DeckitModule.define(
    'deck/service/deck/remove',
    {
        uses: ['deck/service/storage', 'deck/service/mod/manifest', 'deck/service/deck/install'],
        provides: ['remove', 'forgetData', 'forgotten', 'clearForgotten'],
        runs: 'node',
    },
    (STORAGE, MANIFEST, INSTALL) => {
        // MARK: - Property
        const fs = require('fs');
        const FORGOTTEN = 'forgotten';

        // MARK: - Initializer
        // MARK: - Public
        // The installed mod with this id, every copy of it. With `data`, what it stored goes too.
        function remove(id, { data = false } = {}) {
            const copies = INSTALL.installed().get(id);
            if (!copies) throw new Error('no installed mod ' + id);
            for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
            return { data: data && forgetData(id) };
        }

        // What a mod stored, taken away: whether there was any to take. An id that is no mod id never loaded, so
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

        function clearForgotten(modId) {
            STORAGE.state.write(
                FORGOTTEN,
                forgotten().filter((id) => id !== modId)
            );
        }

        // MARK: - Private

        return { remove, forgetData, forgotten, clearForgotten };
    }
);
