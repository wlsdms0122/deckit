// Between main and a page the shell draws in, about the page's overlay.
import * as CHANNEL from '../../deckit/channel/index.js';

// The page may open its overlay: answers the name it opens it by (window.open('', name)), at once.
export const open = CHANNEL.pageToMain(
    'deckit-shell:overlay-open',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// What the overlay holds: `shows`, anything drawn, so it is laid over the page; `focused`, an element drawn in it
// having the keyboard; `regions`, the rects `{ x, y, width, height }` of what is drawn that takes presses, from the
// overlay's top left; `materials`, `{ material, x, y, width, height, cornerRadius }`, where what is drawn is glass, a
// material laid under the overlay there.
export const state = CHANNEL.pageToMain(
    'deckit-shell:overlay-state',
    {
        shows: 'boolean',
        focused: 'boolean',
        regions: 'array',
        materials: 'array',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// The overlay asks for the keyboard its page has, for an element drawn in it that holds the focus.
export const take = CHANNEL.pageToMain('deckit-shell:overlay-take', {}, { guard: CHANNEL.GUARD.ANY });
