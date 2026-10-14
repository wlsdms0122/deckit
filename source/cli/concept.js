// Which unit and concept a file is. A unit (core, deck, deckit, the shell) is one module: its root files are what the
// others reach it by, and each folder in it a concept, its core files and its model/.
const path = require('path');

const UNITS = new Set(['core', 'deck', 'deckit', 'shell']);

// `file` is the path under source/deckit, as library.files() lists it.
function conceptOf(file) {
    const [unit] = file.split('/');
    if (!UNITS.has(unit)) return null;
    return { library: unit, concept: path.posix.dirname(file).replace(/\/model$/, ''), layer: unit };
}

module.exports = { conceptOf, UNITS };
