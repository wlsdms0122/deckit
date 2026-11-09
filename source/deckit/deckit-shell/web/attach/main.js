import { checked } from '../../deckit/environment/index.js';
import * as ENVIRONMENT from '../environment/index.js';
import * as WEB_PERMISSION from '../../../deckit-sdk/web/engine/model/permission.js';
import * as WEB_LAYER from '../../../deckit-sdk/web/engine/model/layer.js';
import { createWeb } from '../engine/main.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// How a host app puts the web engine on deckit, once, before it is ready: `deckit` is what connect answered, and
// `environment` what the environment gives the web engine (environment: WEB). It defines the permissions the web
// engine checks, keeps its state in a folder of its own, and stacks its layer on each mod's page, handed the names
// of the mod's web sessions there. The web engine starts with deckit, before any mod launches. Answers what a UI on
// deckit reads of the web pages mods show: `pageFor(page)`, the page of deckit's a page answers to,
// `holdsKeyboard(page)`, whether the keyboard is in that page or a web page in it, and `onPage(listener(page)) -> off`,
// each web page told as the web engine adopts it, before it watches the page's input.
function attach(deckit, environment) {
    const ENV = checked(environment, ENVIRONMENT.WEB, 'the environment');
    for (const permission of WEB_PERMISSION.PERMISSIONS) deckit.permissions.define(permission);
    const WEB = createWeb({ deckit, state: deckit.stateIn('web'), web: ENV.web, pages: ENV.pages, open: ENV.open });
    deckit.stack(WEB_LAYER.LAYER, { setup: (id) => ({ sessions: ENV.web.sessionsOf(id) }) });
    deckit.onStart(WEB.start);
    return Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard, onPage: WEB.onPage });
}

// MARK: - Private

export { attach };
