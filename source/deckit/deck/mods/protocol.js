// Between a page of a mod with deckit.mods and main, about the mods.
import * as IPC from '../ipc.js';

export const mods = IPC.rendererToMain('deck:mods', {}, { reply: true, sync: true });
export const install = IPC.rendererToMain('deck:mods-install', { from: 'string' }, { reply: true });
export const remove = IPC.rendererToMain('deck:mods-remove', { id: 'string', data: 'boolean' }, { reply: true });
export const relaunch = IPC.rendererToMain('deck:mods-relaunch', { id: 'string' }, { reply: true });
export const count = IPC.rendererToMain('deck:mods-count', { id: 'string' }, { reply: true });
// The sending page hears modsChanged from then on, while it lasts.
export const watchMods = IPC.rendererToMain('deck:mods-watch', {});
// What `mods` answers may have changed: a mod found or gone, a run that moved.
export const modsChanged = IPC.mainToRenderer('deck:mods-changed');
