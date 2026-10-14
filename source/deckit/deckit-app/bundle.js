// Deckit.app's folder, around the deckit archive it embeds: its own files, its entry, and deckit's page bundles its
// preload is made of, in the order they load. Paths are from this folder.
module.exports = {
    files: ['main.js', 'app.js', 'window.js', 'config.js'],
    entry: 'main.js',
    preload: ['page', 'shell-page'],
};
