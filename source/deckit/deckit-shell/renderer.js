import { connect } from './deckit/connect/renderer.js';
import * as SHELL from './shell/attach/renderer.js';

// MARK: - Public
// Deckit on every page it makes, with the shell's layer and the pages the shell draws.
function start(given) {
    connect(given, { layers: SHELL.LAYERS, page: SHELL.page });
}

export { start };
