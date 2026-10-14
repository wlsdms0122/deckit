// Between main and every page deckit makes, about what the page is.
DeckitModule.define(
    'deckit/feature/app/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['setup'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { page } at once, the name of a page the shell made, or {} for a mod's: a page is built in one pass.
        setup: IPC.rendererToMain('deckit:app-setup', {}, { reply: true, sync: true }),
    })
);
