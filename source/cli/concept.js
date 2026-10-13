// Which concept and layer a file of the library is. A concept is a module folder, its core files and its model/.
// The plugin system is one concept cut by process into folders of its own, so all of service/plugin is one.
const path = require('path');

const LAYERS = new Set(['config', 'feature', 'service', 'module', 'ui']);
const ONE_CONCEPT = ['service/plugin'];

// `file` is the path under the library, as library.files() lists it.
function conceptOf(file) {
    const layer = file.split('/')[0];
    if (!LAYERS.has(layer)) return null;
    const folder = path.posix.dirname(file).replace(/\/model$/, '');
    const whole = ONE_CONCEPT.find((group) => folder === group || folder.startsWith(group + '/'));
    return { concept: whole || folder, layer };
}

module.exports = { conceptOf, LAYERS };
