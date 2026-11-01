// A mod with a window of its own, not an overlay, and a page 420 by 300 in it. The test opens and closes the window
// and opens the switcher by its command by events it sends the page.
class WindowUser {
    attach(shell, deckit) {
        const window = shell.window.register({ content: document.createElement('div'), width: 420, height: 300 });
        document.addEventListener('test-window-open', () => window.open());
        document.addEventListener('test-window-close', () => window.close());
        document.addEventListener('test-switcher', () =>
            deckit.commands.run({ provider: 'switcher', command: 'show' })
        );
    }
}

module.exports = WindowUser;
