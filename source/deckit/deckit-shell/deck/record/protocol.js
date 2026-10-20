// Between a mod's page and main, about the mod's records.
import * as CHANNEL from '../channel/index.js';

export const readRecord = CHANNEL.pageToMain(
    'deckit-shell:record-read',
    { key: 'string' },
    { reply: true, sync: true }
);
export const writeRecord = CHANNEL.pageToMain(
    'deckit-shell:record-write',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const removeRecord = CHANNEL.pageToMain('deckit-shell:record-remove', { key: 'string' }, { reply: true });
export const recordKeys = CHANNEL.pageToMain('deckit-shell:record-keys', {}, { reply: true, sync: true });
