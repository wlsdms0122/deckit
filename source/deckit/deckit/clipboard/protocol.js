import * as IPC from '../../core/ipc/index.js';

export const readText = IPC.rendererToMain('deckit:clipboard-read', {}, { reply: true });
export const writeText = IPC.rendererToMain('deckit:clipboard-write', { text: 'string' }, { reply: true });
