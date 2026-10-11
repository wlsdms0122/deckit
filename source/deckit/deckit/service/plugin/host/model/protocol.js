// Between a plugin's view and main. Main knows which plugin a message is from by the view it came from.
DeckitModule.define(
    'deckit/service/plugin/host/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'load',
            'started',
            'failed',
            'requirements',
            'callExport',
            'exportCalled',
            'callMain',
            'mainEvent',
            'readRecord',
            'writeRecord',
            'removeRecord',
            'recordKeys',
            'recordPath',
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
        // What the view runs: the plugin's manifest, its view source, its main half's state, its settings.
        load: IPC.rendererToMain('deckit:plugin-load', {}, { reply: true, sync: true }),
        // Made, with what it contributes. `settings`: its declarations, without functions. `exports`: values copied,
        // and the paths of its functions.
        started: IPC.rendererToMain('deckit:plugin-started', {
            settings: 'object',
            exports: 'object',
            summary: 'object',
        }),
        // A problem recorded against the plugin, which Settings shows.
        failed: IPC.rendererToMain('deckit:plugin-failed', { why: 'string' }),
        // Answers once every plugin it requires has started or failed: { [id]: { values, functions } or { error } }.
        requirements: IPC.rendererToMain('deckit:plugin-requirements', {}, { reply: true }),
        callExport: IPC.rendererToMain(
            'deckit:plugin-call-export',
            { plugin: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        exportCalled: IPC.mainToRenderer('deckit:plugin-export-called', { reply: true }),
        callMain: IPC.rendererToMain('deckit:plugin-call-main', { op: 'string', args: 'array' }, { reply: true }),
        mainEvent: IPC.mainToRenderer('deckit:plugin-main-event'),

        readRecord: IPC.rendererToMain('deckit:record-read', { key: 'string' }, { reply: true, sync: true }),
        writeRecord: IPC.rendererToMain('deckit:record-write', { key: 'string', value: 'any' }, { reply: true }),
        removeRecord: IPC.rendererToMain('deckit:record-remove', { key: 'string' }, { reply: true }),
        recordKeys: IPC.rendererToMain('deckit:record-keys', {}, { reply: true, sync: true }),
        recordPath: IPC.rendererToMain('deckit:record-path', { key: 'string?' }, { reply: true, sync: true }),

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
