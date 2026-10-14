// Between a mod's page and main. Main knows which mod a message is from by the view it came from, and which run
// of that page by the `run` that `load` answered, carried back by what tells main how the run went.
DeckitModule.define(
    'deck/service/deck/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: [
            'load',
            'declare',
            'started',
            'problem',
            'notStarted',
            'stop',
            'requirements',
            'callExport',
            'exportCalled',
            'callExtension',
            'extensionCalled',
            'extensionsChanged',
            'readRecord',
            'writeRecord',
            'removeRecord',
            'recordKeys',
            'setSetting',
            'settingChanged',
            'settingOptions',
            'runSetting',
            'mods',
            'pick',
            'install',
            'remove',
            'relaunch',
            'reveal',
            'count',
            'modSettings',
            'setModSetting',
            'runModSetting',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // What the page runs: the mod's manifest, its entry's source, its settings, and which run this is.
        load: IPC.rendererToMain('deck:mod-load', {}, { reply: true, sync: true }),
        // Its settings, as soon as its entry is read: the declarations, without functions.
        declare: IPC.rendererToMain('deck:mod-declare', { run: 'number', settings: 'object' }),
        // Started, with what it contributes. `contributions`: `{ exports, extensionPoints, extensions }`, exports and
        // each extension as its values copied and the paths of its functions, beside what is on deck added; `summary`,
        // what it contributes as a person reads it.
        started: IPC.rendererToMain('deck:mod-started', {
            run: 'number',
            contributions: 'object',
            summary: 'object',
        }),
        // A problem recorded against the mod, which a person reads on its row.
        problem: IPC.rendererToMain('deck:mod-problem', { run: 'number?', problem: 'string' }),
        // It did not start, and why: what the mods that require it are told.
        notStarted: IPC.rendererToMain('deck:mod-not-started', { run: 'number?', problem: 'string' }),
        // Its run is ending: answered once the mod's stop() has run.
        stop: IPC.mainToRenderer('deck:mod-stop', { reply: true }),
        // Answers once every mod it requires has started or failed: { [id]: { values, functions } or { error } }.
        requirements: IPC.rendererToMain('deck:mod-requirements', {}, { reply: true }),
        callExport: IPC.rendererToMain(
            'deck:mod-call-export',
            { run: 'number', mod: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        exportCalled: IPC.mainToRenderer('deck:mod-export-called', { reply: true }),
        // An extension point's mod calls a function of what another mod extends it with.
        callExtension: IPC.rendererToMain(
            'deck:mod-call-extension',
            { run: 'number', mod: 'string', point: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        extensionCalled: IPC.mainToRenderer('deck:mod-extension-called', { reply: true }),
        // The extensions of one of the mod's points now, by its name: { name, extensions: { [mod id]: { values,
        // functions } } }.
        extensionsChanged: IPC.mainToRenderer('deck:mod-extensions-changed'),

        readRecord: IPC.rendererToMain('deck:record-read', { key: 'string' }, { reply: true, sync: true }),
        writeRecord: IPC.rendererToMain('deck:record-write', { key: 'string', value: 'any' }, { reply: true }),
        removeRecord: IPC.rendererToMain('deck:record-remove', { key: 'string' }, { reply: true }),
        recordKeys: IPC.rendererToMain('deck:record-keys', {}, { reply: true, sync: true }),

        setSetting: IPC.rendererToMain('deck:setting-set', { key: 'string', value: 'any' }, { reply: true }),
        settingChanged: IPC.mainToRenderer('deck:setting-changed'),
        settingOptions: IPC.mainToRenderer('deck:setting-options', { reply: true }),
        runSetting: IPC.mainToRenderer('deck:setting-run', { reply: true }),

        // deckit.mods
        mods: IPC.rendererToMain('deck:mods', {}, { reply: true, sync: true }),
        pick: IPC.rendererToMain('deck:mods-pick', {}, { reply: true }),
        install: IPC.rendererToMain('deck:mods-install', { from: 'string' }, { reply: true }),
        remove: IPC.rendererToMain('deck:mods-remove', { id: 'string', data: 'boolean' }, { reply: true }),
        relaunch: IPC.rendererToMain('deck:mods-relaunch', { id: 'string' }, { reply: true }),
        reveal: IPC.rendererToMain('deck:mods-reveal', { id: 'string' }, { reply: true }),
        count: IPC.rendererToMain('deck:mods-count', { id: 'string' }, { reply: true }),

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
