// Between a mod's page and main, about the mod's records.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

export const readRecord = CHANNEL.pageToMain(
    'deckit-shell:record-read',
    { key: 'string' },
    { reply: true, sync: true, guard: CHANNEL.GUARD.MOD }
);
export const writeRecord = CHANNEL.pageToMain(
    'deckit-shell:record-write',
    { key: 'string', value: 'any' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
export const removeRecord = CHANNEL.pageToMain(
    'deckit-shell:record-remove',
    { key: 'string' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
export const recordKeys = CHANNEL.pageToMain(
    'deckit-shell:record-keys',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.MOD }
);
