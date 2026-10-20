import * as IPC from '../deck/ipc/index.js';

export const readText = IPC.rendererToMain('deckit-electron:clipboard-read', {}, { reply: true });
export const writeText = IPC.rendererToMain('deckit-electron:clipboard-write', { text: 'string' }, { reply: true });
