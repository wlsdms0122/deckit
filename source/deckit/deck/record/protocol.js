// Between a mod's page and main, about the mod's records.
DeckitModule.define(
    'deck/record/protocol',
    {
        uses: ['core/ipc'],
        provides: ['readRecord', 'writeRecord', 'removeRecord', 'recordKeys'],
        runs: 'electron',
    },
    (IPC) => ({
        readRecord: IPC.rendererToMain('deck:record-read', { key: 'string' }, { reply: true, sync: true }),
        writeRecord: IPC.rendererToMain('deck:record-write', { key: 'string', value: 'any' }, { reply: true }),
        removeRecord: IPC.rendererToMain('deck:record-remove', { key: 'string' }, { reply: true }),
        recordKeys: IPC.rendererToMain('deck:record-keys', {}, { reply: true, sync: true }),
    })
);
