// @@NAME@@: the page half. Everything it gets arrives in context; see deckit's document/PLUGIN.md.
Deckit.register({
    // Drawn about 18px; currentColor follows the theme.
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
           <circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>
         </svg>`,
    // Quick switcher aliases besides its name.
    keywords: ['@@ID@@'],

    make({ theme, ui }) {
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

        // Only what this plugin contributes: no sidebar means no second column.
        return {
            content,
            // Asked each time the switcher opens.
            commands: () => [
                {
                    label: '@@NAME@@: hello',
                    run: () =>
                        ui.dialog({
                            title: '@@NAME@@',
                            message: 'This is a plugin. Edit @@ID@@/page.js and save.',
                            confirmLabel: 'Nice',
                            onConfirm: () => {},
                        }),
                },
            ],
        };
    },
});
