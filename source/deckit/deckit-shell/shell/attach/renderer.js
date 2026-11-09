import { checked } from '../../deckit/environment/index.js';
import * as ENVIRONMENT from '../environment/index.js';
import { shellOf } from '../../../deckit-sdk/shell/mod/renderer.js';
import * as SHELL_LAYER from '../../../deckit-sdk/shell/mod/model/layer.js';
import * as PAGE from '../../../deckit-sdk/shell/page/renderer.js';
import * as DESKTOP from '../desktop/frame.js';
import * as DESKTOP_PAGE from '../desktop/model/page-name.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The shell on a page deckit makes, `given` what the environment gives it there (environment: SHELL_PAGE): its layer
// over deckit's on a mod's page, by its name (deckit/connect/renderer.js: layers), `channels` binding the shell's
// channels, and the presses in the page's drag regions taken from `given`.
function layersOf(given) {
    const ENV = checked(given, ENVIRONMENT.SHELL_PAGE, 'what the environment gives a page');
    return Object.freeze({ [SHELL_LAYER.LAYER]: ({ channels }) => shellOf({ channels, drags: ENV.drags }) });
}

// A page the shell made: the desktop's. `channels` binds the shell's channels in the page.
function page(name, { channels }) {
    if (name === DESKTOP_PAGE.PAGE_NAME) DESKTOP.boot(PAGE.start({ channels }), channels);
}

// MARK: - Private

export { layersOf, page };
