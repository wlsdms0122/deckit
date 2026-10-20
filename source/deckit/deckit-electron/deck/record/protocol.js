// Between a mod's page and main, about the mod's records.
import * as CHANNEL from '../../../deckit-shell/deck/channel/index.js';

export const readRecord = CHANNEL.pageToMain(
    'deckit-electron:record-read',
    { key: 'string' },
    { reply: true, sync: true }
);
export const writeRecord = CHANNEL.pageToMain(
    'deckit-electron:record-write',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const removeRecord = CHANNEL.pageToMain('deckit-electron:record-remove', { key: 'string' }, { reply: true });
export const recordKeys = CHANNEL.pageToMain('deckit-electron:record-keys', {}, { reply: true, sync: true });
