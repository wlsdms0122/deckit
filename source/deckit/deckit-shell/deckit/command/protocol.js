import * as CHANNEL from '../../deck/channel/index.js';

// Each question carries the session it is for, whose entries the page keeps until it ends.
export const collect = CHANNEL.mainToPage('deckit-shell:command-collect', { reply: true });
export const collectNow = CHANNEL.mainToPage('deckit-shell:command-collect-now', { reply: true });
export const resolve = CHANNEL.mainToPage('deckit-shell:command-resolve', { reply: true });
export const search = CHANNEL.mainToPage('deckit-shell:command-search', { reply: true });
export const run = CHANNEL.mainToPage('deckit-shell:command-run', { reply: true });
export const end = CHANNEL.mainToPage('deckit-shell:command-end');
