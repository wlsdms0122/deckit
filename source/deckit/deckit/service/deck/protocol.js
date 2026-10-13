// Between a plugin's page and main. Main knows which plugin a message is from by the view it came from, and which run
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
            'plugins',
            'pick',
            'install',
            'remove',
            'reveal',
            'count',
            'restartPending',
            'pluginSettings',
            'setPluginSetting',
            'runPluginSetting',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // What the page runs: the plugin's manifest, its entry's source, its settings, and which run this is.
        load: IPC.rendererToMain('deckit:plugin-load', {}, { reply: true, sync: true }),
        // Its settings, as soon as its entry is read: the declarations, without functions.
        declare: IPC.rendererToMain('deckit:plugin-declare', { run: 'number?', settings: 'object' }),
        // Started, with what it contributes. `exports`: values copied, and the paths of its functions.
        started: IPC.rendererToMain('deckit:plugin-started', { run: 'number?', exports: 'object', summary: 'object' }),
        // A problem recorded against the plugin, which Settings shows.
        problem: IPC.rendererToMain('deckit:plugin-problem', { run: 'number?', problem: 'string' }),
        // It did not start, and why: what the plugins that require it are told.
        notStarted: IPC.rendererToMain('deckit:plugin-not-started', { run: 'number?', problem: 'string' }),
        // Its run is ending: answered once the plugin's stop() has run.
        stop: IPC.mainToRenderer('deckit:plugin-stop', { reply: true }),
        // Answers once every plugin it requires has started or failed: { [id]: { values, functions } or { error } }.
        requirements: IPC.rendererToMain('deckit:plugin-requirements', {}, { reply: true }),
        callExport: IPC.rendererToMain(
            'deckit:plugin-call-export',
            { plugin: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        exportCalled: IPC.mainToRenderer('deckit:plugin-export-called', { reply: true }),
        // A main process module of the plugin's, by its path in the plugin's folder: started once, answering
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

        // deckit.plugins
        plugins: IPC.rendererToMain('deckit:plugins', {}, { reply: true, sync: true }),
        pick: IPC.rendererToMain('deckit:plugins-pick', {}, { reply: true }),
        install: IPC.rendererToMain('deckit:plugins-install', { from: 'string' }, { reply: true }),
        remove: IPC.rendererToMain('deckit:plugins-remove', { id: 'string', data: 'boolean' }, { reply: true }),
        reveal: IPC.rendererToMain('deckit:plugins-reveal', { id: 'string' }, { reply: true }),
        count: IPC.rendererToMain('deckit:plugins-count', { id: 'string' }, { reply: true }),
        restartPending: IPC.rendererToMain('deckit:plugins-restart-pending', {}, { reply: true, sync: true }),

        // deckit.plugin-settings
        pluginSettings: IPC.rendererToMain('deckit:plugin-settings', {}, { reply: true }),
        setPluginSetting: IPC.rendererToMain(
            'deckit:plugin-settings-set',
            { plugin: 'string', key: 'string', value: 'any' },
            { reply: true }
        ),
        runPluginSetting: IPC.rendererToMain(
            'deckit:plugin-settings-run',
            { plugin: 'string', key: 'string' },
            { reply: true }
        ),
    })
);
