// Which concept and layer a file of the library is. A concept is a module folder, its core files and its model/.
const path = require('path');

const LAYERS = new Set(['config', 'feature', 'service', 'module', 'ui']);

// `file` is the path under the library, as library.files() lists it.
function conceptOf(file) {
    const layer = file.split('/')[0];
    if (!LAYERS.has(layer)) return null;
    return { concept: path.posix.dirname(file).replace(/\/model$/, ''), layer };
}

module.exports = { conceptOf, LAYERS };
