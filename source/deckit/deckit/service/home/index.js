DeckitModule.define(
    'deckit/service/home',
    {
        uses: ['deckit/config'],
        provides: ['folder', 'plugins', 'staging', 'shipped', 'data', 'records', 'settings', 'state', 'logs'],
        runs: 'node',
    },
    (CONFIG) => {
        // MARK: - Property
        const os = require('os');
        const path = require('path');
        // Not the app's userData: an app that updates can be reinstalled under it.
        const folder = CONFIG.home || path.join(os.homedir(), '.config', CONFIG.id);
        const plugins = path.join(folder, 'plugins');

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return {
            folder,
            plugins,
            // Beside the plugins, on the same disk so an install ends in a rename, and outside them so a copy
            // half made is never read as a plugin.
            staging: path.join(folder, '.plugins-installing'),
            // Inside the plugins, so what removes them removes the record too.
            shipped: path.join(plugins, '.shipped'),
            // A plugin's main half owns its data folder whole; what deckit keeps for a plugin is beside it.
            data: path.join(folder, 'data'),
            records: path.join(folder, 'records'),
            settings: path.join(folder, 'settings'),
            state: path.join(folder, 'state'),
            logs: path.join(folder, 'logs'),
        };
    }
);
