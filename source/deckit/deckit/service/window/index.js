DeckitModule.define(
    'deckit/service/window',
    {
        uses: ['deckit/service/log/main'],
        provides: ['start', 'open', 'get', 'close', 'place', 'windowOf'],
        runs: 'main',
    },
    (LOG) => {
        // MARK: - Property
        const windows = new Map(); // key -> window
        const placed = new WeakMap(); // view -> { window, bounds, onClose }
        const inWindow = new WeakMap(); // window -> Set of the views placed in it
        let shell = null;

        // MARK: - Initializer
        // `openWindow` is the shell's: the window, its bar and where in it the view goes are the app's.
        function start({ openWindow }) {
            shell = { openWindow };
        }

        // MARK: - Public
        // A window of the app's holding `view`, or the one already open under `key`. `onClose` runs once the view is
        // out of the window.
        function open({ key = null, view, title = '', size = null, onClose = null } = {}) {
            const already = key && get(key);
            if (already) return already;
            const window = shell.openWindow({ view, title, size, onClose });
            if (key) {
                windows.set(key, window);
                LOG.guard(window, 'closed', () => windows.get(key) === window && windows.delete(key));
            }
            return window;
        }

        function get(key) {
            const window = windows.get(key);
            return window && !window.isDestroyed() ? window : null;
        }

        function close(key) {
            const window = get(key);
            window?.close();
            return !!window;
        }

        // A view in any window, sized to it or to `bounds`, and taken out alive before the window closes. `bounds` is
        // a rect, or a function of the window's content size for a rect that follows it. Without `front`, a view
        // already there is not added again, which would lift it over what was added after it.
        function place(view, window, { bounds = null, front = false, onClose = null } = {}) {
            const was = placed.get(view)?.window;
            if (was && was !== window) unplace(view);
            if (front || !window.contentView.children.includes(view)) window.contentView.addChildView(view);
            placed.set(view, { window, bounds, onClose });
            follow(window);
            inWindow.get(window).add(view);
            size(view);
        }

        function windowOf(view) {
            return placed.get(view)?.window || null;
        }

        // MARK: - Private
        function size(view) {
            const at = placed.get(view);
            if (!at || at.window.isDestroyed()) return;
            const [width, height] = at.window.getContentSize();
            const bounds = typeof at.bounds === 'function' ? at.bounds({ width, height }) : at.bounds;
            view.setBounds(bounds || { x: 0, y: 0, width, height });
        }

        function unplace(view) {
            const at = placed.get(view);
            if (!at) return;
            placed.delete(view);
            inWindow.get(at.window)?.delete(view);
            if (!at.window.isDestroyed()) at.window.contentView.removeChildView(view);
        }

        // A closing window destroys every view still in it, and touching a destroyed webContents in main throws. So
        // views are taken out on `close`, not `closed`.
        function follow(window) {
            if (inWindow.has(window)) return;
            inWindow.set(window, new Set());
            LOG.guard(window, 'resize', () => {
                for (const view of inWindow.get(window)) size(view);
            });
            LOG.guard(window, 'close', () => {
                for (const view of [...inWindow.get(window)]) {
                    const { onClose } = placed.get(view);
                    unplace(view);
                    onClose?.(view);
                }
            });
        }

        return { start, open, get, close, place, windowOf };
    }
);
