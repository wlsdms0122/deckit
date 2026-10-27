// Between a mod's page and main, about configuration: a mod's own, and with deckit.mod-configuration every mod's.
import * as CHANNEL from '../../deck/channel/index.js';

// What its class declares, as soon as its entry is read: answered with the values it reads as, which the core checked.
export const declare = CHANNEL.pageToMain(
    'deckit-shell:configuration-declare',
    { run: 'number', configuration: 'array' },
    { reply: true }
);
export const set = CHANNEL.pageToMain(
    'deckit-shell:configuration-set',
    { key: 'string', value: 'any' },
    { reply: true }
);
// { key, value }: a value of its changed.
export const changed = CHANNEL.mainToPage('deckit-shell:configuration-changed');
// deckit.mod-configuration
export const list = CHANNEL.pageToMain('deckit-shell:mod-configuration', {}, { reply: true });
export const setOf = CHANNEL.pageToMain(
    'deckit-shell:mod-configuration-set',
    { mod: 'string', key: 'string', value: 'any' },
    { reply: true }
);
