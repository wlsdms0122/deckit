// Between main and a mod's page, about the regions it gives its children.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // The mods whose view names the sending mod as parent: [{ id, name, icon }], in the person's order.
        children: IPC.rendererToMain('deckit-shell:region-children', {}, { reply: true, sync: true }),
        // Where one of the sending page's regions is in the page: its element's rect.
        rect: IPC.rendererToMain('deckit-shell:region-rect', {
            region: 'number',
            x: 'number',
            y: 'number',
            width: 'number',
            height: 'number',
        }),
        // The child a region shows, or none: refused for a mod that is not the sender's child.
        place: IPC.rendererToMain('deckit-shell:region-place', { region: 'number', id: 'string?' }, { reply: true }),
        // The region's element left the page.
        end: IPC.rendererToMain('deckit-shell:region-end', { region: 'number' }),

        // { children }: as `children` answers, each time it changes.
        childrenChanged: IPC.mainToRenderer('deckit-shell:region-children-changed'),
    });
}
