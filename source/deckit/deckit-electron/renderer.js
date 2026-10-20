import * as PAGE from './page/renderer.js';
import * as IPC from './deck/ipc/index.js';
import * as ORIGIN from './deck/sandbox/model/origin.js';
import { createRun } from './deck/runner/run.js';
import { createRunner } from './deck/runner/renderer.js';
import { createRecord } from './deck/record/renderer.js';
import { createExport } from './deck/export/renderer.js';
import { createExtension } from './deck/extension/renderer.js';
import { createMods } from './deck/mods/renderer.js';
import { createWeb } from './web/renderer.js';
import { createNotification } from './notification/renderer.js';
import { createKeymap } from './keymap/renderer.js';
import { createCommand } from './command/renderer.js';
import { createMod } from './mod/renderer.js';

// MARK: - Public
// The entry of every page deckit makes: a mod's, or one the shell made. `before` is the set of the names the page's
// global object had before deckit's bundles ran: what they added goes, so a mod reaches deckit only through what it is
// handed. `shell` is the renderer side of the shell on deckit, if one is: `page(name, { channels })` draws a page it
// made, `mod(context)` is what it gives each mod (mod/renderer.js), and its `questions`, what main asks its pages, are
// heard from here on. Nothing starts off deckit's scheme: the preload runs on an error page too, which is no mod's.
function boot({ before, shell = null } = {}) {
    for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
    if (location.protocol !== ORIGIN.SCHEME.scheme + ':') return;
    for (const declared of shell?.questions || []) IPC.forLayer.bind(declared);
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => start(shell), { once: true });
    else start(shell);
}

// MARK: - Private
// Deckit in the page, made of deck's page parts and its own, each handed what it uses: deck's runner runs the mod,
// with what deckit and the shell give it.
function start(shell) {
    const { page, sessionPrefix } = PAGE.setup();
    if (page) return shell?.page(page, { channels: IPC.forLayer });
    const RUN = createRun();
    const RUNNER = createRunner({
        RUN,
        STORAGE: createRecord(),
        EXPORT: createExport({ RUN }),
        EXTENSION: createExtension({ RUN }),
        MODS: createMods({ RUN }),
    });
    const MOD = createMod({
        WEB: createWeb({ sessionPrefix }),
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
    });
    RUNNER.start({ layer: MOD.layerOf(shell?.mod || null) });
}

export { boot };
