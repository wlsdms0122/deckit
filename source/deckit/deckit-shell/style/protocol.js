// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // The styles a page wears now, in order, the last winning: what mods give it and every page.
        current: IPC.rendererToMain('deckit-shell:style-current', {}, { reply: true, sync: true }),
        // They changed: { styles }.
        changed: IPC.mainToRenderer('deckit-shell:style-changed'),
    });
}
