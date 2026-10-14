// Between main and every page the UI draws in, about how it looks.
DeckitModule.define(
    'deckit-ui/feature/app/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['setup'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { theme } at once, the app's, which a page draws in from the start.
        setup: IPC.rendererToMain('deckit:ui-setup', {}, { reply: true, sync: true }),
    })
);
