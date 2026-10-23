// Deckit.app's folder, around the deckit archive it embeds: its own files, its entry, and deckit's renderer bundles its
// preload is made of, in the order they load. Paths are from this folder.
module.exports = {
    files: ['main.js', 'app/app.js', 'window/window.js', 'theme/theme.js', 'config/config.js'],
    entry: 'main.js',
    preload: ['renderer', 'shell-renderer'],
};
