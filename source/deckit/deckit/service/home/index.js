DeckitModule.define(
    'deckit/service/home',
    {
        uses: ['deckit/service/home/model/config'],
        provides: ['folder', 'pluginInstall'],
        runs: 'node',
    },
    (CONFIG) => {
        const os = require('os');
        const path = require('path');
        // DECKIT_HOME: a development shell runs this exact code without touching the real folder.
        const HOME = process.env.DECKIT_HOME || path.join(os.homedir(), '.config', CONFIG.id);
        const root = process.env.DECKIT_PLUGIN_HOME || path.join(HOME, 'plugins');
        return Object.freeze({
            folder: HOME,
            pluginInstall: Object.freeze({
                root,
                // Beside the root: on the same disk, so the last step is a rename, and outside it, so a half-made
                // copy is never read as a plugin.
                staging: path.join(path.dirname(root), '.' + path.basename(root) + '-installing'),
                // A file inside the root: never read as a plugin, and moved and deleted with the plugins.
                packageList: path.join(root, '.package'),
            }),
        });
    }
);
