import * as IPC from '../ipc/renderer.js';
import * as LOG from '../log/renderer.js';
import * as ENVIRONMENT from '../environment/index.js';
import * as SETUP from '../setup/renderer.js';
import { createRun } from '../runner/run.js';
import { createRunner } from '../runner/renderer.js';
import { createRecord } from '../record/renderer.js';
import { createConnection } from '../connection/renderer.js';
import { createEvent } from '../event/renderer.js';
import { createMods } from '../mods/renderer.js';
import { createNotification } from '../notification/renderer.js';
import { createMod } from '../mod/renderer.js';

// MARK: - Public
// Deckit on every page it makes, a mod's or one that runs no mod, as the environment boots the page with what it gives
// a page (environment: PAGE). Called as the page's preload runs: the page listens to main at once, so what main asks
// before the page's code answers waits for it, and the rest starts once the document is there.
// `layers` makes each layer that may stack over deckit's on a mod's page, by its name: `make({ setup, channels })` ->
// the layer, `setup` what the layer's setup in main answered for the mod, or null, and `channels` what binds the
// layer's channels. `page(name, { channels })` draws a page that runs no mod, `name` the name it was made by.
function connect(given, { layers, page }) {
    const ENV = ENVIRONMENT.checked(given, ENVIRONMENT.PAGE, 'what the environment gives a page');
    if (typeof layers !== 'object' || !layers || !Object.values(layers).every((make) => typeof make === 'function'))
        throw new Error('[deckit] layers names a function that makes each layer');
    if (typeof page !== 'function') throw new Error('[deckit] page is a function that draws a page');
    // What a listener on the page's channels throws goes to deckit's log, as main's does.
    IPC.carry(ENV, { report: (label, failure) => LOG.error(`${label} failed`, failure) });
    const go = () => run({ ENV, layers, page });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
}

// MARK: - Private
// A page that runs no mod is drawn; a mod's runs, the runner handed deckit's layer with those stacked over it, each
// part handed what it uses.
function run({ ENV, layers, page }) {
    const { page: name, layers: stacked } = SETUP.setup();
    if (name) return page(name, { channels: IPC.layerChannels });
    const RUN = createRun();
    const RUNNER = createRunner({
        RUN,
        STORAGE: createRecord(),
        CONNECTION: createConnection({ RUN }),
        EVENT: createEvent({ RUN }),
        MODS: createMods({ RUN }),
        modules: ENV.modules,
    });
    const MOD = createMod({ NOTIFICATION: createNotification() });
    // The layers stacked over deckit, in the order they stacked, each by its name.
    const over = stacked.flatMap(({ name: each, setup }) => {
        if (Object.hasOwn(layers, each)) return [[each, layers[each]({ setup, channels: IPC.layerChannels })]];
        LOG.error(`no layer on a mod's page is named ${each}, so none stacks for it`);
        return [];
    });
    RUNNER.start({ layers: [['deckit', MOD.layer], ...over] });
}

export { connect };
