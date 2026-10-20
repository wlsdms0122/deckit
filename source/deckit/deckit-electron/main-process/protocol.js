// Between a mod's page and main, about the mod's main process modules.
import * as CHANNEL from '../../deckit-shell/channel/index.js';

// A main process module of the mod's, by its path in the mod's folder: started once, answering
// { path, methods }, the paths of its functions.
export const start = CHANNEL.pageToMain('deckit-electron:main-process-start', { path: 'string' }, { reply: true });
export const call = CHANNEL.pageToMain(
    'deckit-electron:main-process-call',
    { path: 'string', method: 'array', args: 'array' },
    { reply: true }
);
// What a module emits: { path, name, args }.
export const event = CHANNEL.mainToPage('deckit-electron:main-process-event');
// deckit.mods: the mods whose main process modules only a restart of the app brings up to date.
export const restartPending = CHANNEL.pageToMain(
    'deckit-electron:main-process-restart-pending',
    {},
    { reply: true, sync: true }
);
