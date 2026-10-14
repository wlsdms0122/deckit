// Between a mod's page and main, about settings: a mod's own, and with deckit.mod-settings every mod's.
DeckitModule.define(
    'deck/setting/protocol',
    {
        uses: ['core/ipc'],
        provides: [
            'declare',
            'setSetting',
            'settingChanged',
            'settingOptions',
            'runSetting',
            'modSettings',
            'setModSetting',
            'runModSetting',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // Its settings, as soon as its entry is read: the declarations, without functions.
        declare: IPC.rendererToMain('deck:mod-declare', { run: 'number', settings: 'object' }),
        setSetting: IPC.rendererToMain('deck:setting-set', { key: 'string', value: 'any' }, { reply: true }),
        settingChanged: IPC.mainToRenderer('deck:setting-changed'),
        settingOptions: IPC.mainToRenderer('deck:setting-options', { reply: true }),
        runSetting: IPC.mainToRenderer('deck:setting-run', { reply: true }),
        // deckit.mod-settings
        modSettings: IPC.rendererToMain('deck:mod-settings', {}, { reply: true }),
        setModSetting: IPC.rendererToMain(
            'deck:mod-settings-set',
            { mod: 'string', key: 'string', value: 'any' },
            { reply: true }
        ),
        runModSetting: IPC.rendererToMain('deck:mod-settings-run', { mod: 'string', key: 'string' }, { reply: true }),
    })
);
