// Between main and every page the shell draws in, about the theme it draws in.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // Answers { theme } at once: the host app's, or null until it gives one.
        setup: IPC.rendererToMain('deckit-shell:theme-setup', {}, { reply: true, sync: true }),

        // { theme }: the host app's new one.
        change: IPC.mainToRenderer('deckit-shell:theme-change'),
    });
}
