// A mod that gives the status bar an item that comes and goes: a glyph's item, set as the bar connects, whose command
// toggles a view of its own under the item's anchor. On `test-item` it sets the item the test names, or removes it
// for none, and marks how that ended; it marks how many times its command ran. On `test-center` it toggles the
// notification center, with no input of the person's reaching it, and marks the answer.
const ITEM = { name: 'Star', icon: 'star', command: 'show' };

class StatusItem {
    start(deckit) {
        deckit.exports.register({ connect: () => ({ runCommand: async () => this.show?.() }) });
    }

    attach(shell, deckit) {
        const marks = document.documentElement.dataset;
        let bar = null;
        const set = (item) =>
            bar?.set(item).then(
                () => (marks.set = 'set'),
                (error) => (marks.set = error.kind)
            );
        deckit.dependencies.onConnect('status-bar/items', (connected) => {
            bar = connected;
            set(ITEM);
            return () => (bar = null);
        });
        let view = null;
        this.show = () => {
            marks.ran = String(Number(marks.ran || 0) + 1);
            if (view) return view.toggle();
            view = shell.windows.open({
                name: 'view',
                level: 'panel',
                anchor: { mod: 'status-bar', id: 'status-item' },
                content: shell.ui.element('div', { text: 'Item', style: { padding: '6px 10px' } }),
                width: 320,
                height: 200,
            });
        };
        document.addEventListener('test-item', ({ detail }) =>
            detail ? set(detail) : bar?.remove().then(() => (marks.set = 'removed'))
        );
        let center = null;
        deckit.dependencies.onConnect('notifications/center', (connected) => {
            center = connected;
            return () => (center = null);
        });
        document.addEventListener('test-center', () =>
            center?.toggle().then(
                (open) => (marks.center = String(open)),
                (error) => (marks.center = 'failed: ' + error.message)
            )
        );
    }
}

module.exports = StatusItem;
