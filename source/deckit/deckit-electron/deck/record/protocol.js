// Between a mod's page and main, about the mod's records.
import * as IPC from '../ipc/index.js';

export const readRecord = IPC.rendererToMain(
    'deckit-electron:record-read',
    { key: 'string' },
    { reply: true, sync: true }
);
export const writeRecord = IPC.rendererToMain(
    'deckit-electron:record-write',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const removeRecord = IPC.rendererToMain('deckit-electron:record-remove', { key: 'string' }, { reply: true });
export const recordKeys = IPC.rendererToMain('deckit-electron:record-keys', {}, { reply: true, sync: true });
