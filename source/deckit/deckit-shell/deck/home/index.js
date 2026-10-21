// Deckit's folder, and its log folder in it. `user` is the person's home folder, as the environment knows it. Where
// in it deck keeps what it keeps the core answers (`CORE.folders()`).
export function createHome({ CONFIG, FOLDERS, user }) {
    // MARK: - Property
    // Not where the host app keeps its own: an app that updates can be reinstalled under it.
    const folder = FOLDERS.home || join(user, '.config', CONFIG.id);

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
    function join(...parts) {
        return parts.join('/');
    }

    return {
        folder,
        logs: join(folder, 'logs'),
    };
}
