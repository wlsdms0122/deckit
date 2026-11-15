// Between main and a mod's page, about its windows, each by the id main gave it.
import * as CHANNEL from '../../deckit/channel/index.js';
import * as WINDOW_PERMISSION from './model/permission.js';

// A window opens, or the one of that name open orders front: answers `{ id, surface }` at once, `surface` the name
// the page opens its content by (window.open('', surface)). `level` is 'normal', 'overlay' or 'panel', `edge` a panel
// window's, 'top' or 'right', or `anchor`, `{ mod, id }`, the anchor it stands under in place of an edge
// (model/anchor.js nameOf), refused NOT_PERMITTED where that anchor is given to another mod, or `place`, the name of
// the place of the stage it stands at in place of both, refused INVALID_ARGUMENT where the shell knows no place of that
// name; `activates` false leaves the key window where it is. A normal window's title bar:
// `titleBar` 'unified' or 'titled', `titleBarHeight`, `controlsX` and `controlsY` where its buttons stand from the
// frame's top left, `closable`, `minimizable` and `resizable` which of them act; and its `title`.
export const open = CHANNEL.pageToMain(
    'deckit-shell:window-open',
    {
        name: 'string',
        level: 'string',
        edge: 'string?',
        anchor: 'object?',
        place: 'string?',
        width: 'number?',
        height: 'number?',
        minWidth: 'number?',
        minHeight: 'number?',
        activates: 'boolean?',
        titleBar: 'string?',
        titleBarHeight: 'number?',
        controlsX: 'number?',
        controlsY: 'number?',
        closable: 'boolean?',
        minimizable: 'boolean?',
        resizable: 'boolean?',
        title: 'string?',
    },
    { reply: true, sync: true, guard: WINDOW_PERMISSION.permissionOf }
);
export const close = CHANNEL.pageToMain('deckit-shell:window-close', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
export const minimize = CHANNEL.pageToMain(
    'deckit-shell:window-minimize',
    { id: 'number' },
    { guard: CHANNEL.GUARD.ANY }
);
export const zoom = CHANNEL.pageToMain('deckit-shell:window-zoom', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
// In front, the key window left where it is.
export const orderFront = CHANNEL.pageToMain(
    'deckit-shell:window-order-front',
    { id: 'number' },
    { guard: CHANNEL.GUARD.ANY }
);
// The key window, in front.
export const makeKeyAndOrderFront = CHANNEL.pageToMain(
    'deckit-shell:window-make-key-and-order-front',
    {
        id: 'number',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// A view, put away where it is shown and shown where it is not.
export const toggle = CHANNEL.pageToMain('deckit-shell:window-toggle', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
export const resize = CHANNEL.pageToMain(
    'deckit-shell:window-resize',
    {
        id: 'number',
        width: 'number',
        height: 'number',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// The title a titled window's bar holds.
export const setTitle = CHANNEL.pageToMain(
    'deckit-shell:window-set-title',
    { id: 'number', title: 'string' },
    { guard: CHANNEL.GUARD.ANY }
);
// The rects the window's mod names in its content, each for one mod to stand a view of its own under: `anchors`,
// `[{ id, rect, mod }]` (model/anchor.js heldTo), all of them each time, in place of those told before.
export const setAnchors = CHANNEL.pageToMain(
    'deckit-shell:window-set-anchors',
    { id: 'number', anchors: 'array' },
    { guard: CHANNEL.GUARD.ANY }
);
// A press in the content's drag regions moves the window: `phase` 'began' at the press, then 'changed' and 'ended',
// `dx`, `dy` how far the pointer went since the press, on the screen, `x`, `y` where it pressed in the content.
export const move = CHANNEL.pageToMain(
    'deckit-shell:window-move',
    {
        id: 'number',
        phase: 'string',
        dx: 'number',
        dy: 'number',
        x: 'number?',
        y: 'number?',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// A double click in the content's drag regions, the title bar's.
export const doubleClick = CHANNEL.pageToMain(
    'deckit-shell:window-double-click',
    { id: 'number' },
    { guard: CHANNEL.GUARD.ANY }
);

// `{ id, shown, key, width, height, titleBar, room }`, each time any of it changes: `shown` whether it is on some
// seat's screen, `key` whether it is some seat's key window, `titleBar` `{ height, controlsWidth }`, the title bar over
// the content's top and where its area starts past the buttons, or null for content under no bar of the shell's, and
// `room` `{ width, height }`, the room a panel window at the edge `top` has in the bar, or null for any other.
export const state = CHANNEL.mainToPage('deckit-shell:window-state');
// `{ id }`: the window closed.
export const closed = CHANNEL.mainToPage('deckit-shell:window-closed');
// The mod's Dock item was clicked while it has no window open: the instance's reopen().
export const reopen = CHANNEL.mainToPage('deckit-shell:window-reopen');
