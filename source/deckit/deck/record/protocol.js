// Between a mod's page and main, about the mod's records.
import * as IPC from '../../core/ipc/index.js';

export const readRecord = IPC.rendererToMain('deck:record-read', { key: 'string' }, { reply: true, sync: true });
export const writeRecord = IPC.rendererToMain('deck:record-write', { key: 'string', value: 'any' }, { reply: true });
export const removeRecord = IPC.rendererToMain('deck:record-remove', { key: 'string' }, { reply: true });
export const recordKeys = IPC.rendererToMain('deck:record-keys', {}, { reply: true, sync: true });
