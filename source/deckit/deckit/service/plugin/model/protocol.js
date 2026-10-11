DeckitModule.define(
    'deckit/service/plugin/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'list',
            'order',
            'setOrder',
            'pick',
            'install',
            'remove',
            'reveal',
            'dataSize',
            'refresh',
            'restartPending',
            'call',
            'event',
            'dataGet',
            'dataKeys',
            'dataPath',
            'dataSet',
            'dataRemove',
            'dataChanged',
        ],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            list: IPC.ask('deckit:plugin-list', {}, { now: true }),
            order: IPC.ask('deckit:plugin-order', {}, { now: true }),
            setOrder: IPC.ask('deckit:plugin-order-set', { ids: 'array' }),
            // Describes the picked folder without installing it; null when cancelled.
            pick: IPC.ask('deckit:plugin-pick', {}),
            install: IPC.ask('deckit:plugin-install', { from: 'string' }),
            remove: IPC.ask('deckit:plugin-remove', { id: 'string', alsoData: 'boolean' }),
            reveal: IPC.ask('deckit:plugin-reveal', { id: 'string' }),
            // Answers { count, capped, hidden }: capped when counting stopped early, hidden when hidden files are there too.
            dataSize: IPC.ask('deckit:plugin-data-size', { id: 'string' }),
            refresh: IPC.ask('deckit:plugin-refresh', {}),
            // Answers [{ id, why }]: what only a restart can finish.
            restartPending: IPC.ask('deckit:restart-pending', {}, { now: true }),
            call: IPC.ask('deckit:plugin-call', { plugin: 'string', op: 'string', args: 'array' }),
            event: IPC.tell('deckit:plugin-event', { plugin: 'string', name: 'string', args: 'array' }),
            // dataGet answers the JSON text or null; dataPath without a key answers the plugin's data folder.
            dataGet: IPC.ask('deckit:data-get', { plugin: 'string', key: 'string' }, { now: true }),
            dataKeys: IPC.ask('deckit:data-keys', { plugin: 'string' }, { now: true }),
            dataPath: IPC.ask('deckit:data-path', { plugin: 'string', key: 'string?' }, { now: true }),
            dataSet: IPC.ask('deckit:data-set', { plugin: 'string', key: 'string', json: 'string' }),
            dataRemove: IPC.ask('deckit:data-remove', { plugin: 'string', key: 'string' }),
            dataChanged: IPC.tell('deckit:data-changed', { plugin: 'string', key: 'string' }),
        })
);
