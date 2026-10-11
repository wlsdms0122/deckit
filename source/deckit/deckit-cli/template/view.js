// @@NAME@@: the page half. Everything it gets arrives in context; see deckit's document/PLUGIN.md.
Deckit.register({
    // Around 18px; currentColor follows the theme.
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
           <circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>
         </svg>`,
    // Quick switcher aliases besides its name.
    keywords: ['@@ID@@'],

    make({ theme, ui }) {
        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.contentColor,
            font: '14px ' + theme.font,
        });
        content.textContent = '@@NAME@@';

        // Return only what this plugin contributes: no sidebar means no second column.
        return {
            content,
            // Called each time the switcher opens. ui.dialog owns the scrim and Escape.
            commands: () => [
                {
                    label: '@@NAME@@: hello',
                    run: () =>
                        ui.dialog({
                            title: '@@NAME@@',
                            message: 'This is a plugin. Edit @@ID@@/view.js and save.',
                            confirmLabel: 'Nice',
                            onConfirm: () => {},
                        }),
                },
            ],
        };
    },
});
