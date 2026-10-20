import * as IPC from '../../deckit-electron/deck/ipc/index.js';

// The page may finish loading after the chord that opened it.
export const ready = IPC.rendererToMain('deckit-shell:switcher-ready', {});
export const open = IPC.mainToRenderer('deckit-shell:switcher-open');
export const close = IPC.rendererToMain('deckit-shell:switcher-close', {});
// The list is put away: answered once its exit has played.
export const dismiss = IPC.mainToRenderer('deckit-shell:switcher-dismiss', { reply: true });
// { number }: ⌘1 to ⌘9 pressed in the list.
export const number = IPC.mainToRenderer('deckit-shell:switcher-number');

// The list's entries.
export const need = IPC.rendererToMain('deckit-shell:switcher-need', {});
export const supply = IPC.mainToRenderer('deckit-shell:switcher-supply');
// `now` is sent again on its own as a slow source answers.
export const now = IPC.mainToRenderer('deckit-shell:switcher-now');
// `submenu`: the entry whose submenu was typed in, or absent for the list.
export const query = IPC.rendererToMain('deckit-shell:switcher-query', { raw: 'string', submenu: 'string?' });
export const resolved = IPC.mainToRenderer('deckit-shell:switcher-resolved');
export const pick = IPC.rendererToMain('deckit-shell:switcher-pick', { id: 'string' });
