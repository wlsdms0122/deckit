import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';

// Each question carries the session it is for, whose entries the page keeps until it ends.
export const collect = CHANNEL.mainToPage('deckit-electron:command-collect', { reply: true });
export const collectNow = CHANNEL.mainToPage('deckit-electron:command-collect-now', { reply: true });
export const resolve = CHANNEL.mainToPage('deckit-electron:command-resolve', { reply: true });
export const search = CHANNEL.mainToPage('deckit-electron:command-search', { reply: true });
export const run = CHANNEL.mainToPage('deckit-electron:command-run', { reply: true });
export const end = CHANNEL.mainToPage('deckit-electron:command-end');
