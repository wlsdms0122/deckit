import { connect } from './deckit/connect/renderer.js';
import * as PAGE from './shell/page/renderer.js';
import { shellOf } from './shell/mod/renderer.js';
import * as SHELL_LAYER from './shell/mod/model/layer.js';

// MARK: - Public
// Deckit on every page it makes, with the shell's layer and the pages the shell draws (deckit/connect/renderer.js).
function start(given) {
    connect(given, { layers: { [SHELL_LAYER.LAYER]: shellOf }, page: PAGE.page });
}

export { start };
