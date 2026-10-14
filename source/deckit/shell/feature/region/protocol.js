// Between main and a mod's page, about the regions it gives its children.
DeckitModule.define(
    'shell/feature/region/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['children', 'rect', 'show', 'end', 'childrenChanged'],
        runs: 'electron',
    },
    (IPC) => ({
        // The mods whose view names the sending mod as parent: [{ id, name, icon }], in the person's order.
        children: IPC.rendererToMain('shell:region-children', {}, { reply: true, sync: true }),
        // Where one of the sending page's regions is in the page: its element's rect.
        rect: IPC.rendererToMain('shell:region-rect', {
            region: 'number',
            x: 'number',
            y: 'number',
            width: 'number',
            height: 'number',
        }),
        // The child a region shows, or none: refused for a mod that is not the sender's child.
        show: IPC.rendererToMain('shell:region-show', { region: 'number', id: 'string?' }, { reply: true }),
        // The region's element left the page.
        end: IPC.rendererToMain('shell:region-end', { region: 'number' }),

        // { children }: as `children` answers, each time it changes.
        childrenChanged: IPC.mainToRenderer('shell:region-children-changed'),
    })
);
