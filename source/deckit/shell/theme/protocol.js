// Between main and every page the shell draws in, about the theme it draws in.
DeckitModule.define(
    'shell/theme/protocol',
    {
        uses: ['core/ipc'],
        provides: ['setup', 'change'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { theme } at once: the host app's, or null until it gives one.
        setup: IPC.rendererToMain('shell:theme-setup', {}, { reply: true, sync: true }),

        // { theme }: the host app's new one.
        change: IPC.mainToRenderer('shell:theme-change'),
    })
);
