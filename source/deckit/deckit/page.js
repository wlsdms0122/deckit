import * as PROTOCOL from './protocol.js';
import * as DECK from '../deck/page.js';
import { createPartition } from './web/model/partition.js';
import { createWeb } from './web/page.js';
import { createNotification } from './notification/page.js';
import { createKeymap } from './keymap/page.js';
import { createCommand } from './command/page.js';
import { createMod } from './mod/page.js';

// MARK: - Public
// The entry of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it
// is handed. `shell` is the page side of the shell on deckit, if one is: `page(name)` draws a page it made, and
// `mod(context)` is what it gives each mod (mod/page.js). `host` is what the host app offers its own mod, handed to
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
    const { page, id } = PROTOCOL.setup.invoke();
    if (page) return shell?.page(page);
    const CONFIG = Object.freeze({ id });
    const MOD = createMod({
        CONFIG,
        WEB: createWeb({ PARTITION: createPartition({ CONFIG }) }),
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
        HOST: host,
    });
    DECK.createDeck().start({ layer: MOD.layerOf(shell?.mod || null) });
}

export { boot };
