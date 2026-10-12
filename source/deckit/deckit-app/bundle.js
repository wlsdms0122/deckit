// Deckit.app's own files around each of the library's bundles ({ bundle }), in the order they load. Paths are from
// this folder.
module.exports = {
    main: ['config.js', 'folders.js', { bundle: 'main' }, 'window.js', 'shell.js'],
    page: ['config.js', { bundle: 'page' }],
    entry: 'main.js',
};
