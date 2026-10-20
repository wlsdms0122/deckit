export function createRemove({ STORAGE }) {
    // MARK: - Property
    const UNCLEARED = 'uncleared';

    // MARK: - Initializer
    // MARK: - Public
    // What a mod removed stored, erased once its run has ended and its page closed: its data folder now, and its
    // records, settings, pages' storage and web sessions as they are cleared, so it is noted until they are.
    async function eraseData(id) {
        await STORAGE.erase(id);
        STORAGE.state.write(UNCLEARED, [...new Set([...uncleared(), id])]);
    }

    // The mods whose data was erased and whose records, settings and sessions are not cleared yet.
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

    return { eraseData, uncleared, cleared };
}
