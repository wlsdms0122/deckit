// Between a mod's page and main, about mod folders on this Mac: deckit.mods.
DeckitModule.define(
    'deckit/service/mod-folder/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['pick', 'reveal'],
        runs: 'electron',
    },
    (IPC) => ({
        pick: IPC.rendererToMain('deckit:mod-folder-pick', {}, { reply: true }),
        reveal: IPC.rendererToMain('deckit:mod-folder-reveal', { id: 'string' }, { reply: true }),
    })
);
