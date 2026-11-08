// A mod with windows of its own, which the test opens, resizes and closes by events it sends the page, each by its
// name, and whose Dock item calls reopen(), which opens the first again. It marks on its page what its windows are
// told, in turn, the windows it has, the size its page's ResizeObserver sees of each window's content, and the frames
// its page draws.
const CALLBACKS = ['didAppear', 'didDisappear', 'didBecomeKey', 'didResignKey', 'didClose'];

class WindowUser {
    attach(shell) {
        const marks = document.documentElement.dataset;
        const sizes = new ResizeObserver((entries) => {
            for (const { target, contentRect } of entries)
                marks[`size${target.dataset.name}`] =
                    `${Math.round(contentRect.width)}x${Math.round(contentRect.height)}`;
        });
        const told = (name, callback) => () => (marks.told = `${marks.told || ''}${name} ${callback},`);
        const windows = new Map();
        this.open = ({ name, width, height }) => {
            const content = document.createElement('div');
            content.dataset.name = name;
            const callbacks = Object.fromEntries(CALLBACKS.map((callback) => [callback, told(name, callback)]));
            const window = shell.windows.open({ name, content, width, height, ...callbacks });
            windows.set(name, window);
            sizes.observe(content);
        };
        const frame = () => {
            marks.frames = Number(marks.frames || 0) + 1;
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        document.addEventListener('test-window-open', ({ detail }) => this.open(detail));
        document.addEventListener('test-window-close', ({ detail: name }) => windows.get(name)?.close());
        document.addEventListener('test-window-resize', ({ detail: { name, width, height } }) =>
            windows.get(name)?.resize(width, height)
        );
        document.addEventListener('test-windows', () => {
            marks.windows = shell.windows
                .list()
                .map((window) => `${window.name}${window.isKey ? ' key' : ''}`)
                .join();
        });
    }

    reopen() {
        document.documentElement.dataset.reopened = Number(document.documentElement.dataset.reopened || 0) + 1;
        this.open?.({ name: 'one' });
    }

    detach() {
        this.open = null;
    }
}

module.exports = WindowUser;
