DeckitModule.define(
    'shell/style/protocol',
    {
        uses: ['core/ipc'],
        provides: ['current', 'changed'],
        runs: 'electron',
    },
    (IPC) => ({
        // The styles a page wears now, in order, the last winning: what mods give it and every page.
        current: IPC.rendererToMain('shell:style-current', {}, { reply: true, sync: true }),
        // They changed: { styles }.
        changed: IPC.mainToRenderer('shell:style-changed'),
    })
);
