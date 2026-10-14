DeckitModule.define(
    'deck/storage/home',
    {
        uses: ['deck/config'],
        provides: ['folder', 'mods', 'staging', 'shipped', 'data', 'records', 'settings', 'state', 'logs'],
        runs: 'node',
    },
    (CONFIG) => {
        // MARK: - Property
        const os = require('os');
        const path = require('path');
        // Not the app's userData: an app that updates can be reinstalled under it.
        const folder = CONFIG.home || path.join(os.homedir(), '.config', CONFIG.id);
        const mods = path.join(folder, 'mods');

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return {
            folder,
            mods,
            // Beside the mods, on the same disk so an install ends in a rename, and outside them so a copy
            // half made is never read as a mod.
            staging: path.join(folder, '.mods-installing'),
            // Inside the mods, so what removes them removes the record too.
            shipped: path.join(mods, '.shipped'),
            // A mod's data folder is the mod's own, whatever of it writes there; what deck keeps for a mod is beside
            // it.
            data: path.join(folder, 'data'),
            records: path.join(folder, 'records'),
            settings: path.join(folder, 'settings'),
            state: path.join(folder, 'state'),
            logs: path.join(folder, 'logs'),
        };
    }
);
