// Between main and the panel's pages: its frame, deckit://panel/, and the mods' pages it shows.
import * as IPC from '../../deck/ipc/index.js';

// The frame's page.
// Answers { glass, look, shown, state } at once: the frame is built in one pass.
export const frameSetup = IPC.rendererToMain('deckit-shell:panel-frame-setup', {}, { reply: true, sync: true });
export const pick = IPC.rendererToMain('deckit-shell:panel-pick', { id: 'string' });
// by: -1 back, 1 forward, through the mods shown.
export const step = IPC.rendererToMain('deckit-shell:panel-step', { by: 'number' });
export const reorder = IPC.rendererToMain('deckit-shell:panel-reorder', { ids: 'array' });
// The frame as the person left it: { width, collapsed, navHeight }, any of them.
export const layout = IPC.rendererToMain('deckit-shell:panel-layout', {
    width: 'number?',
    collapsed: 'boolean?',
    navHeight: 'number?',
});
// Where the frame's parts are in the panel, each { x, y, width, height }: `overlay`, what the frame's page covers
// over the mod on screen; `slot`, the room under the list for the mod's sidebar; `content`, the room beside the
// sidebar; `handle`, the width's handle. `animation` { duration, easing }: they move there as the frame does.
export const rects = IPC.rendererToMain('deckit-shell:panel-rects', {
    overlay: 'object',
    slot: 'object',
    content: 'object',
    handle: 'object',
    animation: 'object?',
});
// { mods: [{ id, name, icon }], current, canBack, canForward, frame: { width, collapsed, navHeight },
// chords: { back, forward } }
export const state = IPC.mainToRenderer('deckit-shell:panel-state');
// { floating, titleBar, size }: drawn over something, the window's title bar over the panel's top, and the panel's
// { width, height }.
export const look = IPC.mainToRenderer('deckit-shell:panel-look');
// The panel is taken off screen: answered once the frame has played its exit.
export const exit = IPC.mainToRenderer('deckit-shell:panel-exit', { reply: true });
// The panel moves: answered once the frame has played its exit.
export const leave = IPC.mainToRenderer('deckit-shell:panel-leave', { reply: true });

// The frame's page and the mods' pages.
// { open, animate }: the panel is put on screen or taken off it.
export const visible = IPC.mainToRenderer('deckit-shell:panel-visible');
// { direction: 'in' | 'out' }, around a move.
export const play = IPC.mainToRenderer('deckit-shell:panel-play');

// A mod's page.
// Answers { guide, shown } at once.
export const setup = IPC.rendererToMain('deckit-shell:panel-setup', {}, { reply: true, sync: true });
// Where the page lays out what it shows: { floating, region, content, sidebar, obscured, titleBar, animation }.
// `content` and `sidebar` (or null) are the rooms for the view's parts, `obscured` (or null) what the frame covers,
// `titleBar` { height, controlsWidth } (or null) the window's bar over the page, `region` whether the page is in a
// region of another mod's, and `animation` { duration, easing } (or null) how the rooms move there.
export const guide = IPC.mainToRenderer('deckit-shell:panel-guide');
// Escape, taken in main so a web page in the page cannot keep it: answers whether the page took it.
export const escape = IPC.mainToRenderer('deckit-shell:panel-escape', { reply: true });
// The sending mod asks to be on screen.
export const show = IPC.rendererToMain('deckit-shell:panel-show', {});
// Something floats in the page (a dialog, a menu), so the page answers Escape.
export const floating = IPC.rendererToMain('deckit-shell:panel-floating', { on: 'boolean' });
// The children the person pinned to the panel's list, asked by a mod with deckit.mods; and pinning one.
export const pinned = IPC.rendererToMain('deckit-shell:panel-pinned', {}, { reply: true, sync: true });
export const setPinned = IPC.rendererToMain(
    'deckit-shell:panel-set-pinned',
    { id: 'string', pinned: 'boolean' },
    { reply: true }
);
