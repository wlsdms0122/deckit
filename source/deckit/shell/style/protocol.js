import * as IPC from '../../core/ipc/index.js';

// The styles a page wears now, in order, the last winning: what mods give it and every page.
export const current = IPC.rendererToMain('shell:style-current', {}, { reply: true, sync: true });
// They changed: { styles }.
export const changed = IPC.mainToRenderer('shell:style-changed');
