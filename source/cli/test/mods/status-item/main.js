// A mod that joins the status bar by its manifest alone: an icon's item, which tells the bar no width.
class StatusItem {
    attach(shell) {
        shell.view.register({ content: shell.ui.barItem({ content: shell.ui.icon('star', { size: 16 }) }).element });
    }
}

module.exports = StatusItem;
