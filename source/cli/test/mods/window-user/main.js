// A mod with a window of its own, not an overlay, and a page 420 by 300 in it. The test opens and closes the window,
// asks how the page sits in it and opens the switcher by its command by events it sends the page, and reads the marks.
class WindowUser {
    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        const window = shell.window({ content: document.createElement('div'), width: 420, height: 300 });
        document.addEventListener('test-window-open', () => window.open());
        document.addEventListener('test-window-close', () => window.close());
        document.addEventListener('test-fit', async () => {
            const probe = await deckit.mainProcess('main-process/fit.js');
            marks.fit = JSON.stringify(await probe.fit());
        });
        document.addEventListener('test-switcher', () =>
            deckit.commandRegistry.run({ provider: 'switcher', command: 'show' })
        );
    }
}

module.exports = WindowUser;
