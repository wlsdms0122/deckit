import * as CHANNEL from '../../deckit/channel/index.js';

// The styles a page wears now, in order, the last winning: what mods give it and every page.
export const current = CHANNEL.pageToMain(
    'deckit-shell:style-current',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// They changed: { styles }.
export const changed = CHANNEL.mainToPage('deckit-shell:style-changed');
