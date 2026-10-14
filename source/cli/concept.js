// Which library, concept and layer a file is. A concept is a module folder, its core files and its model/.
const path = require('path');

const LAYERS = {
    deckit: new Set(['config', 'feature', 'service', 'module']),
    shell: new Set(['feature', 'service', 'ui']),
};

// `file` is the path under source/deckit, as library.files() lists it.
function conceptOf(file) {
    const [library, layer] = file.split('/');
    if (!LAYERS[library]?.has(layer)) return null;
    return { library, concept: path.posix.dirname(file).replace(/\/model$/, ''), layer: `${library}/${layer}` };
}

module.exports = { conceptOf, LAYERS };
