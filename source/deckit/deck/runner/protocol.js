// Between a mod's page and the runner. Main knows which mod a message is from by the page it came from, and which run
// of that page by the `run` that `load` answered, carried back by what tells main how the run went.
import * as IPC from '../ipc/index.js';

// What the page runs: the mod's manifest, its entry's source, its settings, and which run this is.
export const load = IPC.rendererToMain('deck:mod-load', {}, { reply: true, sync: true });
// Started, with what it contributes. `contributions`: `{ exports, extensionPoints, extensions }`, exports and
// each extension as its values copied as JSON text and the paths of its functions, beside what is on deck added;
// `summary`, what it contributes as a person reads it.
export const started = IPC.rendererToMain('deck:mod-started', {
    run: 'number',
    contributions: 'object',
    summary: 'object',
});
// A problem recorded against the mod, which a person reads on its row.
export const problem = IPC.rendererToMain('deck:mod-problem', { run: 'number?', problem: 'string' });
// It did not start, and why: what the mods that require it are told.
export const notStarted = IPC.rendererToMain('deck:mod-not-started', { run: 'number?', problem: 'string' });
// Its run is ending: answered once the mod's stop() has run.
export const stop = IPC.mainToRenderer('deck:mod-stop', { reply: true });
