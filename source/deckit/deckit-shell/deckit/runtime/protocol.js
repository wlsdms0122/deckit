import * as CHANNEL from '../channel/index.js';

// At once: a page draws it in one pass.
export const about = CHANNEL.pageToMain('deckit-shell:runtime-about', {}, { reply: true, sync: true });
export const restart = CHANNEL.pageToMain('deckit-shell:runtime-restart', {}, { reply: true });
// Whether the app is in front: one of its windows has the keyboard.
export const active = CHANNEL.pageToMain('deckit-shell:runtime-active', {}, { reply: true });
