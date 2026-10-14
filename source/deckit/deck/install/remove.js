export function createRemove({ STORAGE, MANIFEST, INSTALL }) {
    // MARK: - Property
    const fs = require('fs');
    const UNCLEARED = 'forgotten';

    // MARK: - Initializer
    // MARK: - Public
    // The installed mod with this id, every copy of it. What it stored stays: that goes by eraseData, once its run
    // has ended and its page closed.
    function remove(id) {
        const copies = INSTALL.installed().get(id);
        if (!copies) throw new Error('no installed mod ' + id);
        for (const copy of copies) fs.rmSync(copy, { recursive: true, force: true });
    }

    // What a mod stored, erased: whether there was any to erase. An id that is no mod id never loaded, so it stored
    // nothing. Its pages' storage and its web sessions are their sessions' to clear, so it is noted until they are.
    function eraseData(id) {
        if (MANIFEST.idProblem(id)) return false;
        STORAGE.erase(id);
        STORAGE.state.write(UNCLEARED, [...new Set([...uncleared(), id])]);
        return true;
    }

    // The mods whose data was erased and whose sessions are not cleared yet.
    function uncleared() {
        return STORAGE.state.read(UNCLEARED, []);
    }

    function cleared(modId) {
        STORAGE.state.write(
            UNCLEARED,
            uncleared().filter((id) => id !== modId)
        );
    }

    // MARK: - Private

    return { remove, eraseData, uncleared, cleared };
}
