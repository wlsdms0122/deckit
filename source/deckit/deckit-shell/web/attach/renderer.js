import { checked } from '../../deckit/environment/index.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';
import * as ENVIRONMENT from '../environment/index.js';
import * as WEB_LAYER from '../../../deckit-sdk/web/engine/model/layer.js';
import { createWeb } from '../../../deckit-sdk/web/engine/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The web engine on a page deckit makes, `given` what the environment gives it there (environment: WEB_PAGE): its
// layer over deckit's on a mod's page, by its name (deckit/connect/renderer.js: layers). The layer has no lifecycle of
// its own. It hands every lifecycle of the run the handle `web`, the mod's sessions and downloads, made with that
// lifecycle's scope, and offers a layer over it `surfaces({ owner, open, scope })`, what shows the pages of those
// sessions. `setup` is what main answered for the mod, `{ sessions }`, and `channels` binds the web engine's channels.
function layersOf(given) {
    const ENV = checked(given, ENVIRONMENT.WEB_PAGE, 'what the environment gives a page');
    const make =
        ({ setup, channels }) =>
        ({ mod, granted }) => {
            const WEB = createWeb({ sessions: setup.sessions, web: ENV.web, channels });
            // The request `name`, refused NOT_PERMITTED as its channel's guard holds the mod, then for its arguments.
            const request = (name, asked, send) => REQUEST.requestOf(name, { ...asked, mod: mod.id, granted }, send);
            return {
                frameworks: {
                    web: (scope) =>
                        WEB.forMod({
                            request,
                            scoped:
                                (subscribe) =>
                                (...args) =>
                                    scope.add(subscribe(...args)),
                        }),
                },
                over: Object.freeze({ surfaces: WEB.surfacesOf }),
            };
        };
    return Object.freeze({ [WEB_LAYER.LAYER]: make });
}

// MARK: - Private

export { layersOf };
