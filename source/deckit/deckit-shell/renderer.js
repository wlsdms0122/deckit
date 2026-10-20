import * as IPC from './deck/ipc/renderer.js';
import * as LOG from './deck/log/renderer.js';
import * as ENVIRONMENT from './environment/index.js';
import * as PAGE from './page/renderer.js';
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
import { createMod, mod } from './mod/renderer.js';

// MARK: - Public
// Deckit on every page it makes, a mod's or one the shell made, as the environment boots the page with what it gives
// a page (environment: PAGE). Called as the page's preload runs: the page listens to main at once, so what main asks
// before the page's code answers waits for it, and the rest starts once the document is there.
function start(given) {
    const ENV = ENVIRONMENT.checked(given, ENVIRONMENT.PAGE, 'what the environment gives a page');
    // What a listener on the page's channels throws goes to deckit's log, as main's does.
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => run(ENV), { once: true });
    else run(ENV);
}

// MARK: - Private
// The page the shell made is drawn; a mod's runs, deck's runner handed deckit's layer of `deck` with the shell's UI
// over it when it is on deckit, each part handed what it uses.
function run(ENV) {
    const { page, sessions, attached } = PAGE.setup();
    if (page) return PAGE.page(page, { channels: IPC.layerChannels });
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
        WEB: createWeb({ sessions, web: ENV.web }),
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
        CHANNELS: IPC.layerChannels,
    });
    RUNNER.start({ layer: MOD.layerOf(attached ? mod : null) });
}

export { start };
