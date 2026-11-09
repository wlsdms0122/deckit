import { connect } from './deckit/connect/renderer.js';
import * as WEB from './web/attach/renderer.js';
import * as SHELL from './shell/attach/renderer.js';

// MARK: - Public
// Deckit on every page it makes, with the web engine's layer and the shell's, the host app's own `layers`, by name, as
// connect takes them, and the pages the shell draws. `given` is what the environment gives a page.
function start(given, { layers = {} } = {}) {
    connect(given, { layers: { ...layers, ...WEB.layersOf(given), ...SHELL.LAYERS }, page: SHELL.page });
}

export { start };
