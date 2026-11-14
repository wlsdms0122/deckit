// A mod that joins the status bar by its manifest alone: an icon's item, which tells the bar no width. On
// `test-center` it toggles the notification center, with no input of the person's reaching it, and marks the answer.
class StatusItem {
    attach(shell, deckit) {
        shell.view.register({ content: shell.ui.barItem({ content: shell.ui.icon('star', { size: 16 }) }).element });
        let center = null;
        deckit.dependencies.onConnect('notifications/center', (connected) => {
            center = connected;
            return () => (center = null);
        });
        const marks = document.documentElement.dataset;
        document.addEventListener('test-center', () =>
            center?.toggle().then(
                (open) => (marks.center = String(open)),
                (error) => (marks.center = 'failed: ' + error.message)
            )
        );
    }
}

module.exports = StatusItem;
