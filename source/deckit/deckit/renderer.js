import * as PAGE from './page/renderer.js';
import * as DECK from '../deck/renderer.js';
import { createWeb } from './web/renderer.js';
import { createNotification } from './notification/renderer.js';
import { createKeymap } from './keymap/renderer.js';
import { createCommand } from './command/renderer.js';
import { createMod } from './mod/renderer.js';

// MARK: - Public
// The entry of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it
// is handed. `shell` is the renderer side of the shell on deckit, if one is: `page(name)` draws a page it made, and
// `mod(context)` is what it gives each mod (mod/renderer.js). `host` is what the host app offers its own mod, handed to
// it as `deck.host`. Nothing starts off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before, shell = null, host = null } = {}) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== DECK.SCHEME.scheme + ':') return;
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => start(shell, host), { once: true });
    else start(shell, host);
}

// MARK: - Private
// Deckit in the page, made of deck and its own page parts, each handed what it uses.
function start(shell, host) {
    const { page, hostMod, sessionPrefix } = PAGE.setup();
    if (page) return shell?.page(page);
    const MOD = createMod({
        hostMod,
        WEB: createWeb({ sessionPrefix }),
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
        HOST: host,
    });
    DECK.createDeck().start({ layer: MOD.layerOf(shell?.mod || null) });
}

export { boot };
