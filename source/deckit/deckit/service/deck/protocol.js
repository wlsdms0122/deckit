// Between a mod's page and main. Main knows which mod a message is from by the view it came from, and which run
// of that page by the `run` that `load` answered, carried back by what tells main how the run went.
DeckitModule.define(
    'deckit/service/deck/protocol',
    {
        uses: ['deckit/module/ipc'],
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
            'startMainProcess',
            'callMainProcess',
            'mainProcessEvent',
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
            'restartPending',
            'modSettings',
            'setModSetting',
            'runModSetting',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // What the page runs: the mod's manifest, its entry's source, its settings, and which run this is.
        load: IPC.rendererToMain('deckit:mod-load', {}, { reply: true, sync: true }),
        // Its settings, as soon as its entry is read: the declarations, without functions.
        declare: IPC.rendererToMain('deckit:mod-declare', { run: 'number', settings: 'object' }),
        // Started, with what it contributes. `contributions`: `{ exports, extensionPoints, extensions }`, exports and
        // each extension as its values copied and the paths of its functions, beside what the UI added; `summary`, what
        // Settings shows.
        started: IPC.rendererToMain('deckit:mod-started', {
            run: 'number',
            contributions: 'object',
            summary: 'object',
        }),
        // A problem recorded against the mod, which Settings shows.
        problem: IPC.rendererToMain('deckit:mod-problem', { run: 'number?', problem: 'string' }),
        // It did not start, and why: what the mods that require it are told.
        notStarted: IPC.rendererToMain('deckit:mod-not-started', { run: 'number?', problem: 'string' }),
        // Its run is ending: answered once the mod's stop() has run.
        stop: IPC.mainToRenderer('deckit:mod-stop', { reply: true }),
        // Answers once every mod it requires has started or failed: { [id]: { values, functions } or { error } }.
        requirements: IPC.rendererToMain('deckit:mod-requirements', {}, { reply: true }),
        callExport: IPC.rendererToMain(
            'deckit:mod-call-export',
            { run: 'number', mod: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        exportCalled: IPC.mainToRenderer('deckit:mod-export-called', { reply: true }),
        // An extension point's mod calls a function of what another mod extends it with.
        callExtension: IPC.rendererToMain(
            'deckit:mod-call-extension',
            { run: 'number', mod: 'string', point: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        extensionCalled: IPC.mainToRenderer('deckit:mod-extension-called', { reply: true }),
        // The extensions of one of the mod's points now, by its name: { name, extensions: { [mod id]: { values, functions } } }.
        extensionsChanged: IPC.mainToRenderer('deckit:mod-extensions-changed'),
        // A main process module of the mod's, by its path in the mod's folder: started once, answering
        // { path, methods }, the paths of its functions.
        startMainProcess: IPC.rendererToMain('deckit:main-process-start', { path: 'string' }, { reply: true }),
        callMainProcess: IPC.rendererToMain(
            'deckit:main-process-call',
            { path: 'string', method: 'array', args: 'array' },
            { reply: true }
        ),
        // What a module emits: { path, name, args }.
        mainProcessEvent: IPC.mainToRenderer('deckit:main-process-event'),

        readRecord: IPC.rendererToMain('deckit:record-read', { key: 'string' }, { reply: true, sync: true }),
        writeRecord: IPC.rendererToMain('deckit:record-write', { key: 'string', value: 'any' }, { reply: true }),
        removeRecord: IPC.rendererToMain('deckit:record-remove', { key: 'string' }, { reply: true }),
        recordKeys: IPC.rendererToMain('deckit:record-keys', {}, { reply: true, sync: true }),

        setSetting: IPC.rendererToMain('deckit:setting-set', { key: 'string', value: 'any' }, { reply: true }),
        settingChanged: IPC.mainToRenderer('deckit:setting-changed'),
        settingOptions: IPC.mainToRenderer('deckit:setting-options', { reply: true }),
        runSetting: IPC.mainToRenderer('deckit:setting-run', { reply: true }),

        // deckit.mods
        mods: IPC.rendererToMain('deckit:mods', {}, { reply: true, sync: true }),
        pick: IPC.rendererToMain('deckit:mods-pick', {}, { reply: true }),
        install: IPC.rendererToMain('deckit:mods-install', { from: 'string' }, { reply: true }),
        remove: IPC.rendererToMain('deckit:mods-remove', { id: 'string', data: 'boolean' }, { reply: true }),
        relaunch: IPC.rendererToMain('deckit:mods-relaunch', { id: 'string' }, { reply: true }),
        reveal: IPC.rendererToMain('deckit:mods-reveal', { id: 'string' }, { reply: true }),
        count: IPC.rendererToMain('deckit:mods-count', { id: 'string' }, { reply: true }),
        restartPending: IPC.rendererToMain('deckit:mods-restart-pending', {}, { reply: true, sync: true }),

        // deckit.mod-settings
        modSettings: IPC.rendererToMain('deckit:mod-settings', {}, { reply: true }),
        setModSetting: IPC.rendererToMain(
            'deckit:mod-settings-set',
            { mod: 'string', key: 'string', value: 'any' },
            { reply: true }
        ),
        runModSetting: IPC.rendererToMain('deckit:mod-settings-run', { mod: 'string', key: 'string' }, { reply: true }),
    })
);
