import * as IPC from '../../deck/ipc/index.js';

// At once: a page draws it in one pass.
export const about = IPC.rendererToMain('deckit-electron:runtime-about', {}, { reply: true, sync: true });
export const restart = IPC.rendererToMain('deckit-electron:runtime-restart', {}, { reply: true });
