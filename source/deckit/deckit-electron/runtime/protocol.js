import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';

// At once: a page draws it in one pass.
export const about = CHANNEL.pageToMain('deckit-electron:runtime-about', {}, { reply: true, sync: true });
export const restart = CHANNEL.pageToMain('deckit-electron:runtime-restart', {}, { reply: true });
