export function createHome({ CONFIG, FOLDERS }) {
    // MARK: - Property
    const os = require('os');
    const path = require('path');
    // Not the app's userData: an app that updates can be reinstalled under it.
    const folder = FOLDERS.home || path.join(os.homedir(), '.config', CONFIG.id);
    const mods = path.join(folder, 'mods');

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private

    return {
        folder,
        mods,
        // A mod's data folder is the mod's own, whatever of it writes there; what deck keeps for a mod is beside
        // it.
        data: path.join(folder, 'data'),
        logs: path.join(folder, 'logs'),
    };
}
