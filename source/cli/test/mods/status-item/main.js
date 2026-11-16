// A mod that gives the status bar an item that comes and goes: a glyph's item, set as the bar connects, whose command
// toggles a view of its own under the item's anchor. On `test-item` it sets the item the test names, or removes it
// for none, and marks how that ended; it marks how many times its command ran, and the word its command
// `noted` is run with, as a notification of its own names it. On `test-band` it opens a
// band of its own in the bar as wide as the test names, which takes that much of the bar's room, or closes it for none.
// On `test-post` it posts the notification the test names to deckit/notifications, and marks how that ended.
const ITEM = { name: 'Star', icon: 'star', command: 'show' };

class StatusItem {
    start(deckit) {
        const run = (id, args) => (id === 'noted' ? this.noted?.(args) : this.show?.());
        deckit.exports.register({ connect: () => ({ runCommand: async (id, args) => run(id, args) }) });
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
        let band = null;
        document.addEventListener('test-band', ({ detail: width }) => {
            band?.close();
            const content = shell.ui.element('div', { text: 'Room' });
            band = width ? shell.windows.open({ name: 'band', level: 'panel', content, width, height: 28 }) : null;
        });
        this.noted = ({ word }) => (marks.noted = word);
        let notifications = null;
        deckit.dependencies.onConnect('deckit/notifications', (connected) => {
            notifications = connected;
            return () => (notifications = null);
        });
        document.addEventListener('test-post', ({ detail }) => {
            const posted = notifications ? notifications.post(detail) : Promise.reject({ kind: 'none' });
            posted.then(
                () => (marks.posted = 'posted'),
                (error) => (marks.posted = error.kind)
            );
        });
    }
}

module.exports = StatusItem;
