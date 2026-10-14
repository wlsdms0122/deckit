import * as IPC from '../../deck/ipc.js';

export const readText = IPC.rendererToMain('deckit:clipboard-read', {}, { reply: true });
export const writeText = IPC.rendererToMain('deckit:clipboard-write', { text: 'string' }, { reply: true });
