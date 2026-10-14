import * as IPC from '../../core/ipc/index.js';

// The page may finish loading after the chord that opened it.
export const ready = IPC.rendererToMain('shell:switcher-ready', {});
export const open = IPC.mainToRenderer('shell:switcher-open');
export const close = IPC.rendererToMain('shell:switcher-close', {});
// { token }, which comes back with hidden once the exit has played.
export const dismiss = IPC.mainToRenderer('shell:switcher-dismiss');
export const hidden = IPC.rendererToMain('shell:switcher-hidden', { token: 'number?' });
// { number }: ⌘1 to ⌘9 pressed in the list.
export const number = IPC.mainToRenderer('shell:switcher-number');

// The list's entries.
export const need = IPC.rendererToMain('shell:switcher-need', {});
export const supply = IPC.mainToRenderer('shell:switcher-supply');
// `now` is sent again on its own as a slow source answers.
export const now = IPC.mainToRenderer('shell:switcher-now');
// `page`: the entry whose own page was typed in, or absent for the list.
export const query = IPC.rendererToMain('shell:switcher-query', { raw: 'string', page: 'string?' });
export const resolved = IPC.mainToRenderer('shell:switcher-resolved');
export const pick = IPC.rendererToMain('shell:switcher-pick', { id: 'string' });
