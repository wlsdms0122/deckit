// Between a mod's page and main, about settings: a mod's own, and with deckit.mod-settings every mod's.
import * as CHANNEL from '../../../deckit-shell/channel/index.js';

// Its settings, as soon as its entry is read: the declarations, without functions, in the order declared.
export const declare = CHANNEL.pageToMain('deckit-electron:mod-declare', { run: 'number', settings: 'array' });
export const setSetting = CHANNEL.pageToMain(
    'deckit-electron:setting-set',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const settingChanged = CHANNEL.mainToPage('deckit-electron:setting-changed');
export const settingOptions = CHANNEL.mainToPage('deckit-electron:setting-options', { reply: true });
export const runSetting = CHANNEL.mainToPage('deckit-electron:setting-run', { reply: true });
// deckit.mod-settings
export const modSettings = CHANNEL.pageToMain('deckit-electron:mod-settings', {}, { reply: true });
export const setModSetting = CHANNEL.pageToMain(
    'deckit-electron:mod-settings-set',
    { mod: 'string', key: 'string', value: 'any' },
    { reply: true }
);
export const runModSetting = CHANNEL.pageToMain(
    'deckit-electron:mod-settings-run',
    { mod: 'string', key: 'string' },
    { reply: true }
);
