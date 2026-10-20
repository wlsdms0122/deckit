// Between a page of a mod with deckit.mods and main, about the mods.
import * as CHANNEL from '../channel/index.js';

export const mods = CHANNEL.pageToMain('deckit-shell:mods', {}, { reply: true, sync: true });
export const install = CHANNEL.pageToMain('deckit-shell:mods-install', { from: 'string' }, { reply: true });
export const remove = CHANNEL.pageToMain(
    'deckit-shell:mods-remove',
    { id: 'string', data: 'boolean' },
    { reply: true }
);
export const relaunch = CHANNEL.pageToMain('deckit-shell:mods-relaunch', { id: 'string' }, { reply: true });
export const count = CHANNEL.pageToMain('deckit-shell:mods-count', { id: 'string' }, { reply: true });
// The sending page hears modsChanged from then on, while it lasts.
export const watchMods = CHANNEL.pageToMain('deckit-shell:mods-watch', {});
// What `mods` answers may have changed: a mod found or gone, a run that moved.
export const modsChanged = CHANNEL.mainToPage('deckit-shell:mods-changed');
