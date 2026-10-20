import * as PAGE from './page/renderer.js';
import * as IPC from '../deckit-shell/deck/ipc/renderer.js';
import * as LOG from '../deckit-shell/deck/log/renderer.js';
import * as ORIGIN from './deck/sandbox/model/origin.js';
import * as ENVIRONMENT from '../deckit-shell/environment/index.js';
import { environment } from './environment/renderer.js';
import { createRun } from '../deckit-shell/deck/runner/run.js';
import { createRunner } from '../deckit-shell/deck/runner/renderer.js';
import { createRecord } from '../deckit-shell/deck/record/renderer.js';
import { createExport } from '../deckit-shell/deck/export/renderer.js';
import { createExtension } from '../deckit-shell/deck/extension/renderer.js';
import { createMods } from '../deckit-shell/deck/mods/renderer.js';
import { createWeb } from './web/renderer.js';
import { createNotification } from '../deckit-shell/notification/renderer.js';
import { createKeymap } from '../deckit-shell/keymap/renderer.js';
import { createCommand } from '../deckit-shell/command/renderer.js';
import { createMod } from './mod/renderer.js';

// MARK: - Public
// The entry of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it is
// handed. `shell` is the renderer side of the shell on deckit, if one is: `page(name, { channels })` draws a page it
// made, `channels` binding its channels in the page, and `mod(context)` is what it gives each mod (mod/renderer.js).
// Nothing starts off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before, shell = null } = {}) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== ORIGIN.SCHEME.scheme + ':') return;
    // What a listener on the page's channels throws goes to deckit's log, as main's does.
    const ENV = ENVIRONMENT.checked(environment, ENVIRONMENT.PAGE, 'what Electron gives deck');
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => start(shell, ENV), { once: true });
    else start(shell, ENV);
}

// MARK: - Private
// Deckit in the page, made of deck's page parts and its own, each handed what it uses: deck's runner runs the mod,
// with what deckit and the shell give it.
function start(shell, ENV) {
    const { page, sessionPrefix } = PAGE.setup();
    if (page) return shell?.page(page, { channels: IPC.layerChannels });
    const RUN = createRun();
    const RUNNER = createRunner({
        RUN,
        STORAGE: createRecord(),
        EXPORT: createExport({ RUN }),
        EXTENSION: createExtension({ RUN }),
        MODS: createMods({ RUN }),
        modules: ENV.modules,
    });
    const MOD = createMod({
        WEB: createWeb({ sessionPrefix }),
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
        CHANNELS: IPC.layerChannels,
    });
    RUNNER.start({ layer: MOD.layerOf(shell?.mod || null) });
}

export { boot };
