import * as IPC from './deck/ipc/renderer.js';
import * as LOG from './deck/log/renderer.js';
import * as ENVIRONMENT from './environment/index.js';
import * as PAGE from './shell/page/renderer.js';
import { createRun } from './deck/runner/run.js';
import { createRunner } from './deck/runner/renderer.js';
import { createRecord } from './deck/record/renderer.js';
import { createConnection } from './deck/connection/renderer.js';
import { createEvent } from './deck/event/renderer.js';
import { createMods } from './deck/mods/renderer.js';
import { createWeb } from './deckit/web/renderer.js';
import { createNotification } from './deckit/notification/renderer.js';
import { createKeymap } from './deckit/keymap/renderer.js';
import { createCommand } from './deckit/command/renderer.js';
import { createConfiguration } from './deckit/configuration/renderer.js';
import { createMod } from './deckit/mod/renderer.js';
import { shellOf } from './shell/mod/renderer.js';

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
// The page the shell made is drawn; a mod's runs, deck's runner handed deckit's layer with the shell's stacked over it
// when the shell is on deckit, each part handed what it uses.
function run(ENV) {
    const { page, sessions, attached } = PAGE.setup();
    if (page) return PAGE.page(page, { channels: IPC.layerChannels });
    const RUN = createRun();
    const RUNNER = createRunner({
        RUN,
        STORAGE: createRecord(),
        CONNECTION: createConnection({ RUN }),
        EVENT: createEvent({ RUN }),
        MODS: createMods({ RUN }),
        modules: ENV.modules,
    });
    const WEB = createWeb({ sessions, web: ENV.web });
    const MOD = createMod({
        WEB,
        NOTIFICATION: createNotification(),
        KEYMAP: createKeymap(),
        COMMAND: createCommand(),
        CONFIGURATION: createConfiguration({ RUN }),
    });
    const shell = attached ? shellOf({ WEB, channels: IPC.layerChannels }) : null;
    RUNNER.start({ layer: MOD.layerOf(shell) });
}

export { start };
