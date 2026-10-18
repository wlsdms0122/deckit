// `openWindow` is the host app's: the window, its bar and where in it the view goes are the app's.
export function createWindow({ LOG, openWindow }) {
    // MARK: - Property
    const windows = new Map(); // key -> window
    const placed = new WeakMap(); // view -> { window, bounds, onClose }
    const inWindow = new WeakMap(); // window -> Set of the views placed in it
    const roots = new Set(); // every view placed in a window

    // MARK: - Initializer
    // MARK: - Public
    // A window of the app's holding `view`, of `size`, made by the host app, which puts the view in it with the
    // `place` it is handed. One open under `key` is brought forward instead. `onClose` runs once the view is out
    // of the window.
    function open({ key = null, view, title = '', size = null, onClose = null } = {}) {
        const already = key && get(key);
        if (already) {
            if (already.isMinimized()) already.restore();
            already.show();
            already.focus();
            return already;
        }
        const window = openWindow({
            view,
            title,
            size,
            key,
            place: (into, { bounds = null } = {}) => place(view, into, { bounds, onClose }),
        });
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
        roots.add(view);
        follow(window);
        inWindow.get(window).add(view);
        size(view);
    }

    function windowOf(view) {
        return placed.get(view)?.window || null;
    }

    // The window a page is in, through whichever placed view holds it, the page's own or one it is inside.
    function windowShowing(webContents) {
        for (const view of roots) if (holds(view, webContents)) return placed.get(view).window;
        return null;
    }

    // MARK: - Private
    function size(view) {
        const at = placed.get(view);
        if (!at || at.window.isDestroyed()) return;
        const [width, height] = at.window.getContentSize();
        const bounds = typeof at.bounds === 'function' ? at.bounds({ width, height }) : at.bounds;
        view.setBounds(bounds || { x: 0, y: 0, width, height });
    }

    function holds(view, webContents) {
        return view.webContents === webContents || (view.children || []).some((child) => holds(child, webContents));
    }

    function unplace(view) {
        const at = placed.get(view);
        if (!at) return;
        placed.delete(view);
        roots.delete(view);
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

    return { open, get, close, place, windowOf, windowShowing };
}
