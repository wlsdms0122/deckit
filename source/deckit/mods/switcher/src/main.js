const { switcher } = require('./switcher/switcher.js');

// The quick switcher: each mod to show and the actions mods add through its point `actions`, in a window of its own
// over whichever app is in front, opened from any of them by its key. The window is the list, which the kit's quick
// pick draws over the page.
class Switcher {
    static keywords = ['switcher', 'command', 'palette'];
    static icon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/></svg>`;

    attach(shell, deckit) {
        const window = shell.window({
            content: document.createElement('div'),
            width: 600,
            height: 400,
            overlay: true,
            didDisappear: () => this.list?.closed(),
            didResignKey: () => this.list?.putAway(),
        });
        this.list = switcher(shell, deckit, window, deckit.extensionPoint('actions'));
        deckit.commands({
            show: { description: 'Opens the quick switcher.', run: () => this.list?.show() },
        });
        deckit.keys({
            summon: {
                label: 'Toggle Quick Switcher',
                key: 'alt+space',
                scope: 'global',
                run: () => this.list?.toggle(),
            },
        });
    }

    detach() {
        this.list?.end();
        this.list = null;
    }
}

module.exports = Switcher;
