// @@NAME@@: what deckit runs. Everything it gets arrives in deck; see deckit's document/PLUGIN.md.
module.exports = {
    // Drawn about 18px; currentColor follows the theme.
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
           <circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>
         </svg>`,
    // Quick switcher aliases besides its name.
    keywords: ['@@ID@@'],

    async start({ theme, ui, view, commands, mainProcess }) {
        // Started in the app's main process the first time it is asked for, and kept while the app runs.
        const pinger = await mainProcess('main-process.js');
        // What it emits: pinger.on('woke', (reason) => …).

        const content = ui.element('div', {
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.color.text,
                font: theme.type.medium,
            },
            text: '@@NAME@@',
        });

        view({ content });
        commands(() => [
            {
                label: '@@NAME@@: ping',
                run: async () => {
                    const { at } = await pinger.ping('hello');
                    ui.dialog({
                        title: '@@NAME@@',
                        message: `The main process answered at ${new Date(at).toLocaleTimeString()}.`,
                        confirmLabel: 'Nice',
                        onConfirm: () => {},
                    });
                },
            },
        ]);
    },
};
