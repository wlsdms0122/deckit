import * as ORIGIN from './deck/sandbox/model/origin.js';
import { environment } from './environment/renderer.js';

// MARK: - Public
// The preload of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it is
// handed. `shell` is the shell's renderer side, whose `start(environment)` runs deckit on the page with what Electron
// gives a page. Nothing starts off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before, shell }) {
    if (typeof shell?.start !== 'function') throw new Error("[deckit] boot takes the shell's renderer side as `shell`");
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== ORIGIN.SCHEME.scheme + ':') return;
    shell.start(environment);
}

export { boot };
