// Deckit.app's own files around each of the library's bundles ({ bundle }), in the order they load. Paths are from
// this folder.
module.exports = {
    main: ['config.js', 'folders.js', { bundle: 'main' }, { bundle: 'shell-main' }, 'window.js', 'app.js'],
    page: ['config.js', { bundle: 'page' }, { bundle: 'shell-page' }],
    entry: 'main.js',
};
