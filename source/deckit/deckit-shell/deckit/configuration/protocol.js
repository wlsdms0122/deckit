// Between a mod's page and main, about configuration: a mod's own, and with deckit.mod-configuration every mod's.
import * as CHANNEL from '../channel/index.js';

// What each key the mod's contributes declares reads as, as the page starts.
export const values = CHANNEL.pageToMain('deckit-shell:configuration-values', {}, { reply: true });
// { key, value }, a value of null unsetting it: answers what it reads as now.
export const set = CHANNEL.pageToMain(
    'deckit-shell:configuration-set',
    { key: 'string', value: 'any?' },
    { reply: true }
);
// { key, value }: a value of its changed.
export const changed = CHANNEL.mainToPage('deckit-shell:configuration-changed');
// deckit.mod-configuration
export const list = CHANNEL.pageToMain('deckit-shell:mod-configuration', {}, { reply: true });
export const setOf = CHANNEL.pageToMain(
    'deckit-shell:mod-configuration-set',
    { mod: 'string', key: 'string', value: 'any?' },
    { reply: true }
);
