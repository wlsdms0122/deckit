// Between a mod's page and main, about settings: a mod's own, and with deckit.mod-settings every mod's.
import * as IPC from '../ipc/index.js';

// Its settings, as soon as its entry is read: the declarations, without functions, in the order declared.
export const declare = IPC.rendererToMain('deckit-electron:mod-declare', { run: 'number', settings: 'array' });
export const setSetting = IPC.rendererToMain(
    'deckit-electron:setting-set',
    { key: 'string', value: 'any' },
    { reply: true }
);
export const settingChanged = IPC.mainToRenderer('deckit-electron:setting-changed');
export const settingOptions = IPC.mainToRenderer('deckit-electron:setting-options', { reply: true });
export const runSetting = IPC.mainToRenderer('deckit-electron:setting-run', { reply: true });
// deckit.mod-settings
export const modSettings = IPC.rendererToMain('deckit-electron:mod-settings', {}, { reply: true });
export const setModSetting = IPC.rendererToMain(
    'deckit-electron:mod-settings-set',
    { mod: 'string', key: 'string', value: 'any' },
    { reply: true }
);
export const runModSetting = IPC.rendererToMain(
    'deckit-electron:mod-settings-run',
    { mod: 'string', key: 'string' },
    { reply: true }
);
