// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // The page may finish loading after the chord that opened it.
        ready: IPC.rendererToMain('deckit-shell:switcher-ready', {}),
        open: IPC.mainToRenderer('deckit-shell:switcher-open'),
        close: IPC.rendererToMain('deckit-shell:switcher-close', {}),
        // The list is put away: answered once its exit has played.
        dismiss: IPC.mainToRenderer('deckit-shell:switcher-dismiss', { reply: true }),
        // { number }: ⌘1 to ⌘9 pressed in the list.
        number: IPC.mainToRenderer('deckit-shell:switcher-number'),

        // The list's entries.
        need: IPC.rendererToMain('deckit-shell:switcher-need', {}),
        supply: IPC.mainToRenderer('deckit-shell:switcher-supply'),
        // `now` is sent again on its own as a slow source answers.
        now: IPC.mainToRenderer('deckit-shell:switcher-now'),
        // `page`: the entry whose own page was typed in, or absent for the list.
        query: IPC.rendererToMain('deckit-shell:switcher-query', { raw: 'string', page: 'string?' }),
        resolved: IPC.mainToRenderer('deckit-shell:switcher-resolved'),
        pick: IPC.rendererToMain('deckit-shell:switcher-pick', { id: 'string' }),
    });
}
