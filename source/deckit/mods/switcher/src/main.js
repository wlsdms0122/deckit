const { switcher } = require('./switcher/switcher.js');

// The quick switcher: every command a mod or the app declares and the rows mods add through its point `rows`, in a
// window of its own over whichever app is in front, opened from any of them by its key. The window is the list,
// which the kit's quick pick draws over the page.
module.exports = {
    keywords: ['switcher', 'command', 'palette'],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/></svg>`,

    start(deck) {
        let list = null;
        const window = deck.window({
            content: document.createElement('div'),
            width: 600,
            height: 400,
            overlay: true,
            didDisappear: () => list.closed(),
            didResignKey: () => list.putAway(),
        });
        list = switcher(deck, window, deck.extensionPoint('rows'));
        deck.commands({
            toggle: {
                label: 'Toggle Quick Switcher',
                description: 'Opens the quick switcher, or puts it away.',
                keywords: ['palette'],
                run: () => list.toggle(),
            },
        });
        deck.keys({ summon: { command: 'toggle', key: 'alt+space', scope: 'global' } });
    },
};
