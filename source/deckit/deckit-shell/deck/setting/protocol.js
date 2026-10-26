// Between a mod's page and main, about settings: a mod's own, and with deckit.mod-settings every mod's.
import * as CHANNEL from '../channel/index.js';

// Its settings, as soon as its entry is read: the declarations, without functions, in the order declared.
export const declare = CHANNEL.pageToMain('deckit-shell:mod-declare', { run: 'number', settings: 'array' });
export const setSetting = CHANNEL.pageToMain(
    'deckit-shell:setting-set',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const settingChanged = CHANNEL.mainToPage('deckit-shell:setting-changed');
export const settingOptions = CHANNEL.mainToPage('deckit-shell:setting-options', { reply: true });
// deckit.mod-settings
export const modSettings = CHANNEL.pageToMain('deckit-shell:mod-settings', {}, { reply: true });
export const setModSetting = CHANNEL.pageToMain(
    'deckit-shell:mod-settings-set',
    { mod: 'string', key: 'string', value: 'any' },
    { reply: true }
);
