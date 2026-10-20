// Deckit's folder, and where in it what deckit keeps goes. `user` is the person's home folder, as the environment
// knows it.
export function createHome({ CONFIG, FOLDERS, user }) {
    // MARK: - Property
    // Not where the host app keeps its own: an app that updates can be reinstalled under it.
    const folder = FOLDERS.home || join(user, '.config', CONFIG.id);
    const data = join(folder, 'data');

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
    function join(...parts) {
        return parts.join('/');
    }

    return {
        folder,
        mods: join(folder, 'mods'),
        // A mod's data folder is the mod's own, whatever of it writes there; what deck keeps for a mod is beside
        // it.
        data,
        logs: join(folder, 'logs'),
        // Mod ids are held to their rule before a mod loads, so an id here is a folder name.
        dataOf: (modId) => join(data, modId),
    };
}
