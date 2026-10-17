import { createRun } from './runner/run.js';
import { createRunner } from './runner/renderer.js';
import { createRecord } from './record/renderer.js';
import { createExport } from './export/renderer.js';
import { createExtension } from './extension/renderer.js';
import { createMods } from './mods/renderer.js';

// Deck in a mod's page, made of its parts: `start({ layer })` runs the mod, with what the layers on deck give it.
export function createDeck() {
    const RUN = createRun();
    const STORAGE = createRecord();
    const EXPORT = createExport({ RUN });
    const EXTENSION = createExtension({ RUN });
    const MODS = createMods({ RUN });
    return createRunner({ RUN, STORAGE, EXPORT, EXTENSION, MODS });
}

// A stand-in for what another side holds, its functions called through main, for a layer to hand a mod.
export { proxyOf, deepFreeze } from './export/proxy.js';

// Listeners by event name, for a layer that tells a mod's listeners what happens.
export { make as makeBus } from './event/bus.js';

// The scheme deck's pages load from, for a layer's page to know one of them.
export { SCHEME } from './sandbox/model/origin.js';
