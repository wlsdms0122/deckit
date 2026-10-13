// Between main and every page deckit makes, about what the page is.
DeckitModule.define(
    'deckit/feature/app/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['setup'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { role: 'plugin' | 'switcher', theme } at once: a page is built in one pass.
        setup: IPC.rendererToMain('deckit:app-setup', {}, { reply: true, sync: true }),
    })
);
