// Between main and the panel's pages: its frame, deckit://panel/, and the mods' pages it shows.
import * as CHANNEL from '../deck/channel/index.js';

// The frame's page.
// Answers { glass, look, shown, state } at once: the frame is built in one pass.
export const frameSetup = CHANNEL.pageToMain('deckit-shell:panel-frame-setup', {}, { reply: true, sync: true });
export const pick = CHANNEL.pageToMain('deckit-shell:panel-pick', { id: 'string' });
// by: -1 back, 1 forward, through the mods shown.
export const step = CHANNEL.pageToMain('deckit-shell:panel-step', { by: 'number' });
export const reorder = CHANNEL.pageToMain('deckit-shell:panel-reorder', { ids: 'array' });
// The sidebar as the person left it: { width, collapsed, navHeight }, any of them.
export const layout = CHANNEL.pageToMain('deckit-shell:panel-layout', {
    width: 'number?',
    collapsed: 'boolean?',
    navHeight: 'number?',
});
// The chord of one of the panel's keys, `back` or `forward`, as it is bound now, or ''.
export const chord = CHANNEL.pageToMain('deckit-shell:panel-chord', { action: 'string' }, { reply: true, sync: true });
// Where the frame's parts are in the panel, each { x, y, width, height }: `obscured`, what the frame's page covers
// over the mod on screen; `sidebar`, the slot under the list lent to the mod's sidebar; `content`, the room beside
// the sidebar; `handle`, the width's handle. `animation` { duration, easing }: they move there as the frame does.
export const rects = CHANNEL.pageToMain('deckit-shell:panel-rects', {
    obscured: 'object',
    sidebar: 'object',
    content: 'object',
    handle: 'object',
    animation: 'object?',
});
// { mods: [{ id, name, icon }], current, canBack, canForward, sidebar: { width, collapsed, navHeight }, down }: `down`
// is `{ name, why }` once deckit's core answers nothing more, or null
export const state = CHANNEL.mainToPage('deckit-shell:panel-state');
// { floating, titleBar, size }: drawn over something, the window's title bar over the panel's top, and the panel's
// { width, height }.
export const look = CHANNEL.mainToPage('deckit-shell:panel-look');
// The panel is taken off screen: answered once the frame has played its exit.
export const exit = CHANNEL.mainToPage('deckit-shell:panel-exit', { reply: true });
// The panel moves: answered once the frame has played its exit.
export const leave = CHANNEL.mainToPage('deckit-shell:panel-leave', { reply: true });

// The frame's page and the mods' pages.
// { open, animate }: the panel is put on screen or taken off it.
export const visible = CHANNEL.mainToPage('deckit-shell:panel-visible');
// { direction: 'in' | 'out' }, around a move.
export const play = CHANNEL.mainToPage('deckit-shell:panel-play');

// A mod's page.
// Answers { guide, shown } at once.
export const setup = CHANNEL.pageToMain('deckit-shell:panel-setup', {}, { reply: true, sync: true });
// Where the page lays out what it shows: { floating, region, content, sidebar, obscured, titleBar, animation }.
// `content` and `sidebar` (or null) are the rooms for the view's parts, `obscured` (or null) what the frame covers,
// the window's buttons among it, `titleBar` { height } (or null) the window's bar over the page, `region` whether the
// page is in a region of another mod's, and `animation` { duration, easing } (or null) how the rooms move there.
export const guide = CHANNEL.mainToPage('deckit-shell:panel-guide');
// Escape, taken in main so a web page in the page cannot keep it: answers whether the page took it.
export const escape = CHANNEL.mainToPage('deckit-shell:panel-escape', { reply: true });
// The sending mod asks to be on screen.
export const show = CHANNEL.pageToMain('deckit-shell:panel-show', {});
// Something floats in the page (a dialog, a menu), so the page answers Escape.
export const floating = CHANNEL.pageToMain('deckit-shell:panel-floating', { on: 'boolean' });
// The children the person pinned to the panel's list, asked by a mod with deckit.mods; and pinning one.
export const pinned = CHANNEL.pageToMain('deckit-shell:panel-pinned', {}, { reply: true, sync: true });
export const setPinned = CHANNEL.pageToMain(
    'deckit-shell:panel-set-pinned',
    { id: 'string', pinned: 'boolean' },
    { reply: true }
);
// The person asks for the app to restart, deckit's core having gone down.
export const restart = CHANNEL.pageToMain('deckit-shell:panel-restart', {});
