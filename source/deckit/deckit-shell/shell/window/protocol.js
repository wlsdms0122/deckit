// Between main and a mod's page, about its windows, each by the id main gave it.
import * as CHANNEL from '../../deckit/channel/index.js';

// A window opens, or the one of that name open orders front: answers `{ id, surface }` at once, `surface` the name
// the page opens its content by (window.open('', surface)). `level` is 'normal' or 'overlay'.
export const open = CHANNEL.pageToMain(
    'deckit-shell:window-open',
    {
        name: 'string',
        level: 'string',
        width: 'number?',
        height: 'number?',
        minWidth: 'number?',
        minHeight: 'number?',
    },
    { reply: true, sync: true }
);
export const close = CHANNEL.pageToMain('deckit-shell:window-close', { id: 'number' });
export const minimize = CHANNEL.pageToMain('deckit-shell:window-minimize', { id: 'number' });
export const zoom = CHANNEL.pageToMain('deckit-shell:window-zoom', { id: 'number' });
// In front, and the key window.
export const orderFront = CHANNEL.pageToMain('deckit-shell:window-order-front', { id: 'number' });
export const resize = CHANNEL.pageToMain('deckit-shell:window-resize', {
    id: 'number',
    width: 'number',
    height: 'number',
});
// A press in the content's drag regions moves the window: `phase` 'began' at the press, then 'changed' and 'ended',
// `dx`, `dy` how far the pointer went since the press, on the screen.
export const move = CHANNEL.pageToMain('deckit-shell:window-move', {
    id: 'number',
    phase: 'string',
    dx: 'number',
    dy: 'number',
});
// A double click in the content's drag regions, the title bar's.
export const doubleClick = CHANNEL.pageToMain('deckit-shell:window-double-click', { id: 'number' });

// `{ id, shown, key, width, height, titleBar }`, each time any of it changes: `shown` whether it is on some seat's
// screen, `key` whether it is some seat's key window, `titleBar` `{ height, controlsWidth }`, where the window's
// buttons stand over its top, or null.
export const state = CHANNEL.mainToPage('deckit-shell:window-state');
// `{ id }`: the window closed.
export const closed = CHANNEL.mainToPage('deckit-shell:window-closed');
// The mod's Dock item was clicked while it has no window open: the instance's reopen().
export const reopen = CHANNEL.mainToPage('deckit-shell:window-reopen');
