import * as IPC from '../../deck/ipc/index.js';

// The styles a page wears now, in order, the last winning: what mods give it and every page.
export const current = IPC.rendererToMain('deckit-shell:style-current', {}, { reply: true, sync: true });
// They changed: { styles }.
export const changed = IPC.mainToRenderer('deckit-shell:style-changed');
