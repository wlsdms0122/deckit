// Between a page of a mod with deckit.mods and main, about the mods.
import * as IPC from '../ipc/index.js';

export const mods = IPC.rendererToMain('deckit-electron:mods', {}, { reply: true, sync: true });
export const install = IPC.rendererToMain('deckit-electron:mods-install', { from: 'string' }, { reply: true });
export const remove = IPC.rendererToMain(
    'deckit-electron:mods-remove',
    { id: 'string', data: 'boolean' },
    { reply: true }
);
export const relaunch = IPC.rendererToMain('deckit-electron:mods-relaunch', { id: 'string' }, { reply: true });
export const count = IPC.rendererToMain('deckit-electron:mods-count', { id: 'string' }, { reply: true });
// The sending page hears modsChanged from then on, while it lasts.
export const watchMods = IPC.rendererToMain('deckit-electron:mods-watch', {});
// What `mods` answers may have changed: a mod found or gone, a run that moved.
export const modsChanged = IPC.mainToRenderer('deckit-electron:mods-changed');
