import * as CHANNEL from '../channel/index.js';
import * as MOD_PERMISSION from '../permission/index.js';

// At once: a page draws it in one pass.
export const about = CHANNEL.pageToMain(
    'deckit-shell:runtime-about',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.MOD }
);
export const restart = CHANNEL.pageToMain(
    'deckit-shell:runtime-restart',
    {},
    { reply: true, guard: MOD_PERMISSION.MODS }
);
export const folders = CHANNEL.pageToMain(
    'deckit-shell:runtime-folders',
    {},
    { reply: true, guard: MOD_PERMISSION.MODS }
);
