// Between a mod's page and main, about the mod's main process modules.
import * as IPC from '../../deck/ipc/index.js';

// A main process module of the mod's, by its path in the mod's folder: started once, answering
// { path, methods }, the paths of its functions.
export const start = IPC.rendererToMain('deckit:main-process-start', { path: 'string' }, { reply: true });
export const call = IPC.rendererToMain(
    'deckit:main-process-call',
    { path: 'string', method: 'array', args: 'array' },
    { reply: true }
);
// What a module emits: { path, name, args }.
export const event = IPC.mainToRenderer('deckit:main-process-event');
// deckit.mods: the mods whose main process modules only a restart of the app brings up to date.
export const restartPending = IPC.rendererToMain(
    'deckit:main-process-restart-pending',
    {},
    { reply: true, sync: true }
);
