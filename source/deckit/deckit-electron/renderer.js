import * as ORIGIN from './sandbox/model/origin.js';
import { environment } from './environment/renderer.js';
import { start } from './page/renderer.js';

// MARK: - Public
// The start of the preload of every page deckit makes: a mod's, or one that runs no mod, run in deckit's world as each
// of its documents starts. `before` is the set of the names the world's global object had before deckit's bundles
// ran: what they added goes, so a mod reaches deckit only through what it is handed. Answers what Electron gives the
// page (deckit-shell/environment: PAGE), which the preload hands `deckit-shell`'s `start`, or null off deckit's scheme:
// the preload runs on an error page too, which is no mod's.
function boot({ before }) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== ORIGIN.SCHEME + ':') return null;
    start();
    return environment;
}

export { boot };
