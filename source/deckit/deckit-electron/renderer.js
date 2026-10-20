import * as ORIGIN from './sandbox/model/origin.js';
import { environment } from './environment/renderer.js';

// MARK: - Public
// The start of the preload of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names
// the page's global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through
// what it is handed. Answers what Electron gives the page (deckit-shell/environment: PAGE), which the preload hands
// the shell's `start`, or null off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before }) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    return location.protocol === ORIGIN.SCHEME.scheme + ':' ? environment : null;
}

export { boot };
