import { shellOf } from '../mod/renderer.js';
import * as SHELL_LAYER from '../mod/model/layer.js';

// MARK: - Property
// The shell on a page deckit makes: its layer over deckit's on a mod's page, by its name, and what draws a page the
// shell made (deckit/connect/renderer.js: layers, page).
const LAYERS = Object.freeze({ [SHELL_LAYER.LAYER]: shellOf });

export { LAYERS };
export { page } from '../page/renderer.js';
