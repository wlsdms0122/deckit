import * as IPC from '../../core/ipc/index.js';

// At once: a page draws it in one pass.
export const about = IPC.rendererToMain('deckit:about', {}, { reply: true, sync: true });
export const restart = IPC.rendererToMain('deckit:restart', {}, { reply: true });
