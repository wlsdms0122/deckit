import { createRun } from './runner/run.js';
import { createRunner } from './runner/page.js';
import { createRecord } from './record/page.js';
import { createExport } from './export/page.js';
import { createExtension } from './extension/page.js';
import { createMods } from './mods/page.js';

// Deck in a mod's page, made of its parts: `start({ layer })` runs the mod, with what the layers on deck give it.
export function createDeck() {
    const RUN = createRun();
    const STORAGE = createRecord();
    const EXPORT = createExport({ RUN });
    const EXTENSION = createExtension({ RUN });
    const MODS = createMods({ RUN });
    return createRunner({ RUN, STORAGE, EXPORT, EXTENSION, MODS });
}

// The scheme deck's pages load from, for a layer's page to know one of them.
export { SCHEME } from './sandbox/model/origin.js';
