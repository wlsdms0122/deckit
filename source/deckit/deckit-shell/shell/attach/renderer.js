import { checked } from '../../deckit/environment/index.js';
import * as ENVIRONMENT from '../environment/index.js';
import { shellOf } from '../mod/renderer.js';
import * as SHELL_LAYER from '../mod/model/layer.js';

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

// MARK: - Private

export { layersOf };
export { page } from '../page/renderer.js';
