// Between main and a page the shell draws in, about the page's overlay.
import * as CHANNEL from '../../deck/channel/index.js';

// The page may open its overlay: answers the name it opens it by (window.open('', name)), at once.
export const open = CHANNEL.pageToMain('deckit-shell:overlay-open', {}, { reply: true, sync: true });
// What the overlay holds: `shows`, anything drawn, so it is laid over the page; `layered`, a layer open (a menu, a
// popover, a dialog, a drag), which has the keys, in the overlay while it shows.
export const state = CHANNEL.pageToMain('deckit-shell:overlay-state', { shows: 'boolean', layered: 'boolean' });
