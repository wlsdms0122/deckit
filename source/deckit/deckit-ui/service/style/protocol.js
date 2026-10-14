DeckitModule.define(
    'deckit-ui/service/style/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['current', 'changed'],
        runs: 'electron',
    },
    (IPC) => ({
        // The styles a page wears now, in order, the last winning: what mods give it and every page.
        current: IPC.rendererToMain('deckit:style-current', {}, { reply: true, sync: true }),
        // They changed: { styles }.
        changed: IPC.mainToRenderer('deckit:style-changed'),
    })
);
