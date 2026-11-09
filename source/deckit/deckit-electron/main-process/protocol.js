// Between a mod's page and main, about the mod's main process modules.
import * as CHANNEL from '../../deckit-sdk/deckit/channel/index.js';
import * as MOD_PERMISSION from '../../deckit-sdk/deckit/permission/index.js';
import * as MAIN_PROCESS_PERMISSION from './model/permission.js';

// A main process module of the mod's, by its path in the mod's folder: started once, answering
// { path, methods }, the paths of its functions.
export const start = CHANNEL.pageToMain(
    'deckit-electron:main-process-start',
    { path: 'string' },
    { reply: true, guard: MAIN_PROCESS_PERMISSION.MAIN_PROCESS }
);
export const call = CHANNEL.pageToMain(
    'deckit-electron:main-process-call',
    { path: 'string', method: 'array', args: 'array' },
    { reply: true, guard: MAIN_PROCESS_PERMISSION.MAIN_PROCESS }
);
// What a module emits: { path, name, args }.
export const event = CHANNEL.mainToPage('deckit-electron:main-process-event');
// deckit.mods: the mods whose main process modules only a restart of the app brings up to date, [{ id, why }].
export const restartPending = CHANNEL.pageToMain(
    'deckit-electron:main-process-restart-pending',
    {},
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// deckit.mods: whether a module of the mod's runs, and why those that did not start did not, { running, failure }.
export const statusOf = CHANNEL.pageToMain(
    'deckit-electron:main-process-status-of',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// deckit.mods: the page is told from now on when what `restartPending` or `statusOf` answer may have changed.
export const watch = CHANNEL.pageToMain('deckit-electron:main-process-watch', {}, { guard: MOD_PERMISSION.MODS });
export const changed = CHANNEL.mainToPage('deckit-electron:main-process-changed');
