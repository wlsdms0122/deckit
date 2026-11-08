import { connect } from './deckit/connect/renderer.js';
import * as SHELL from './shell/attach/renderer.js';

// MARK: - Public
// Deckit on every page it makes, with the shell's layer, the host app's own `layers`, by name, as connect takes them,
// and the pages the shell draws.
function start(given, { layers = {} } = {}) {
    connect(given, { layers: { ...layers, ...SHELL.LAYERS }, page: SHELL.page });
}

export { start };
