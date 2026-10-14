// Between main and the pages the panel shows, about the panel itself.
import * as IPC from '../../deck/ipc.js';

// Answers { look, shown, frame, state } at once: the panel's frame is built in one pass.
export const setup = IPC.rendererToMain('deckit-shell:panel-setup', {}, { reply: true, sync: true });
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
// The sending mod asks to be on screen; or the panel to be put away.
export const show = IPC.rendererToMain('deckit-shell:panel-show', {});
export const dismiss = IPC.rendererToMain('deckit-shell:panel-dismiss', {});
// Something floats in the page (a dialog, a menu), so the page answers Escape.
export const floating = IPC.rendererToMain('deckit-shell:panel-floating', { on: 'boolean' });
// The children the person pinned to the panel's list, asked by a mod with deckit.mods; and pinning one.
export const pinned = IPC.rendererToMain('deckit-shell:panel-pinned', {}, { reply: true, sync: true });
export const setPinned = IPC.rendererToMain(
    'deckit-shell:panel-set-pinned',
    { id: 'string', pinned: 'boolean' },
    { reply: true }
);

// { mods: [{ id, name, icon }], current, canBack, canForward, frame: { width, collapsed, navHeight } }
export const state = IPC.mainToRenderer('deckit-shell:panel-state');
// { open, animate }: the panel is put on screen or taken off it.
export const visible = IPC.mainToRenderer('deckit-shell:panel-visible');
// The panel is taken off screen: answered once the page in front has played its exit.
export const exit = IPC.mainToRenderer('deckit-shell:panel-exit', { reply: true });
// { direction: 'in' | 'out' }, around a move.
export const play = IPC.mainToRenderer('deckit-shell:panel-play');
// The panel moves: answered once the page in front has played its exit.
export const leave = IPC.mainToRenderer('deckit-shell:panel-leave', { reply: true });
// { floating, dismissible, titleBar, region }: drawn over something, whether Escape puts it away, the window's
// title bar over the page, and whether the page is in a region of another mod's.
export const look = IPC.mainToRenderer('deckit-shell:panel-look');
// { last }: Escape, taken in main so a web page in the page cannot keep it. `last`: nothing in the page takes it,
// so it puts the panel away.
export const escape = IPC.mainToRenderer('deckit-shell:panel-escape');
