// Between a page of a mod with deckit.mods and main, about the mods.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as MOD_PERMISSION from '../../../deckit-sdk/deckit/permission/index.js';

export const mods = CHANNEL.pageToMain('deckit-shell:mods', {}, { reply: true, guard: MOD_PERMISSION.MODS });
export const plan = CHANNEL.pageToMain(
    'deckit-shell:mods-plan',
    { folder: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const install = CHANNEL.pageToMain(
    'deckit-shell:mods-install',
    { folder: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const remove = CHANNEL.pageToMain(
    'deckit-shell:mods-remove',
    { id: 'string', erase: 'boolean' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const launch = CHANNEL.pageToMain(
    'deckit-shell:mods-launch',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const relaunch = CHANNEL.pageToMain(
    'deckit-shell:mods-relaunch',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const quit = CHANNEL.pageToMain(
    'deckit-shell:mods-quit',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// `mod` absent or null clears the pin.
export const pin = CHANNEL.pageToMain(
    'deckit-shell:mods-pin',
    { interface: 'string', mod: 'string?' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const usage = CHANNEL.pageToMain(
    'deckit-shell:mods-usage',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// The sending page hears modsChanged from then on, while it lasts.
export const watchMods = CHANNEL.pageToMain('deckit-shell:mods-watch', {}, { guard: MOD_PERMISSION.MODS });
// What `mods` answers may have changed: a mod found or gone, a run that moved.
export const modsChanged = CHANNEL.mainToPage('deckit-shell:mods-changed');
