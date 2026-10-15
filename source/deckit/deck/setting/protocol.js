// Between a mod's page and main, about settings: a mod's own, and with deckit.mod-settings every mod's.
import * as IPC from '../ipc/index.js';

// Its settings, as soon as its entry is read: the declarations, without functions.
export const declare = IPC.rendererToMain('deck:mod-declare', { run: 'number', settings: 'object' });
export const setSetting = IPC.rendererToMain('deck:setting-set', { key: 'string', value: 'any' }, { reply: true });
export const settingChanged = IPC.mainToRenderer('deck:setting-changed');
export const settingOptions = IPC.mainToRenderer('deck:setting-options', { reply: true });
export const runSetting = IPC.mainToRenderer('deck:setting-run', { reply: true });
// deckit.mod-settings
export const modSettings = IPC.rendererToMain('deck:mod-settings', {}, { reply: true });
export const setModSetting = IPC.rendererToMain(
    'deck:mod-settings-set',
    { mod: 'string', key: 'string', value: 'any' },
    { reply: true }
);
export const runModSetting = IPC.rendererToMain(
    'deck:mod-settings-run',
    { mod: 'string', key: 'string' },
    { reply: true }
);
