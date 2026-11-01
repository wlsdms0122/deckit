// Windows of Electron's holding a view a mod's main process module made, Electron's own (`window` of what a module is
// handed): one open under a key is brought forward instead, and `onClose` runs once the view is out of a closing
// window, alive.
export function createWindow({ LOG }) {
    // MARK: - Property
    const windows = new Map(); // key -> window

    // MARK: - Initializer
    // MARK: - Public
    function open({ key = null, view, title = '', size = null, onClose = null } = {}) {
        const already = key && get(key);
        if (already) {
            if (already.isMinimized()) already.restore();
            already.show();
            already.focus();
            return already;
        }
        const { BaseWindow } = require('electron');
        const window = new BaseWindow({ ...(size || {}), title, show: false });
        if (view) {
            const fit = () => {
                const [width, height] = window.getContentSize();
                view.setBounds({ x: 0, y: 0, width, height });
            };
            window.contentView.addChildView(view);
            fit();
            LOG.guard(window, 'resize', fit);
            // A closing window destroys every view still in it, so the view is taken out on `close`.
            LOG.guard(window, 'close', () => {
                window.contentView.removeChildView(view);
                onClose?.(view);
            });
        }
        if (key) {
            windows.set(key, window);
            LOG.guard(window, 'closed', () => windows.get(key) === window && windows.delete(key));
        }
        window.show();
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

    // MARK: - Private

    return { open, get, close };
}
