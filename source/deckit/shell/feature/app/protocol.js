// Between main and every page the UI draws in, about how it looks.
DeckitModule.define(
    'shell/feature/app/protocol',
    {
        uses: ['deck/module/ipc'],
        provides: ['setup'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { theme } at once, the app's, which a page draws in from the start.
        setup: IPC.rendererToMain('shell:setup', {}, { reply: true, sync: true }),
    })
);
