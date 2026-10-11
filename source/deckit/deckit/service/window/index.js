DeckitModule.define(
    'deckit/service/window',
    {
        uses: ['deckit/config', 'deckit/service/storage', 'deckit/service/titlebar', 'deckit/service/log/main'],
        provides: ['open', 'get', 'close', 'raise', 'place', 'windowOf', 'optionsFor', 'dress', 'titlebarOf'],
        runs: 'main',
    },
    (CONFIG, STORAGE, TITLEBAR, LOG) => {
        // MARK: - Property
        const DEFAULT_SIZE = { width: 1100, height: 760 };
        const FALLBACK_BACKGROUND = '#1a1d21';
        const windows = new Map(); // key -> { window, view, boundsKey, detached }
        const placed = new WeakMap(); // view -> { window, bounds, onClose }
        const inWindow = new WeakMap(); // window -> Set of the views placed in it
        const titlebars = new WeakMap(); // window -> its title bar

        // MARK: - Initializer
        // MARK: - Public
        // A deckit window holding `view`, opened where it was last left, or raised when the key is already open.
        // `glass` lets what is behind it blur through. `onClose` runs once the view is out of the window.
        function open({
            key,
            title = CONFIG.name,
            view,
            glass = false,
            background,
            size,
            boundsKey,
            style,
            onShown,
            onClose,
        } = {}) {
            const already = get(key);
            if (already) {
                raise(already);
                return already;
            }
            const { BrowserWindow } = require('electron');
            const remembered = `window-${boundsKey || key}`;
            const saved = STORAGE.state.read(remembered, null);
            const window = new BrowserWindow({
                ...DEFAULT_SIZE,
                ...size,
                ...(saved && onScreen(saved) ? saved : saved ? { width: saved.width, height: saved.height } : {}),
                title,
                // No colour with vibrancy: any colour, a clear one too, is laid over the blur. `hud` because macOS
                // offers only materials, and the others tint so much that the glass page over them reads as solid.
                ...(glass
                    ? { vibrancy: 'hud', visualEffectState: 'active' }
                    : { backgroundColor: background || FALLBACK_BACKGROUND }),
                titleBarStyle: 'hidden',
                trafficLightPosition: TITLEBAR.BUTTONS_AT,
            });
            const entry = { window, view, boundsKey: remembered, detached: false };
            windows.set(key, entry);
            // Registered before the view is placed, so it runs while the view is still in the window.
            const release = () => {
                if (entry.detached) return;
                entry.detached = true;
                STORAGE.state.write(entry.boundsKey, window.getNormalBounds());
                unplace(view);
                onShown?.(0);
                onClose?.(view);
            };
            LOG.guard(window, 'close', release);
            place(view, window);
            titlebars.set(window, TITLEBAR.attach(window, { style, onShown }));
            // Kept as it moves, not on close: a quit can take the window without a close event.
            let timer = null;
            const remember = () => {
                clearTimeout(timer);
                timer = setTimeout(() => STORAGE.state.write(entry.boundsKey, window.getNormalBounds()), 400);
            };
            LOG.guard(window, 'resize', remember);
            LOG.guard(window, 'move', remember);
            LOG.guard(window, 'closed', () => windows.get(key) === entry && windows.delete(key));
            return window;
        }

        function get(key) {
            const entry = windows.get(key);
            return entry && !entry.window.isDestroyed() ? entry.window : null;
        }

        function close(key) {
            const window = get(key);
            window?.close();
            return !!window;
        }

        function raise(window) {
            if (window.isMinimized()) window.restore();
            window.show();
            window.focus();
        }

        // A view in any window, sized to it or to `bounds`, and taken out alive before the window closes. Without
        // `front`, a view already there is not added again, which would lift it over the bar.
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

        // How a deckit window looks, for one Chromium makes itself (a popup that keeps its opener).
        function optionsFor(style = {}) {
            return {
                backgroundColor: style.background || FALLBACK_BACKGROUND,
                titleBarStyle: 'hidden',
                trafficLightPosition: TITLEBAR.BUTTONS_AT,
                autoHideMenuBar: true,
            };
        }

        // A window deckit did not lay out (a web page's), given deckit's bar over its page.
        function dress(window, style) {
            titlebars.set(window, TITLEBAR.attach(window, { style, follow: window.webContents }));
        }

        function titlebarOf(window) {
            return titlebars.get(window) || null;
        }

        // MARK: - Private
        function size(view) {
            const at = placed.get(view);
            if (!at || at.window.isDestroyed()) return;
            const [width, height] = at.window.getContentSize();
            view.setBounds(at.bounds || { x: 0, y: 0, width, height });
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

        // A place on a display no longer attached would open the window off screen; its size is still kept.
        function onScreen(bounds) {
            const { screen } = require('electron');
            return screen.getAllDisplays().some(({ workArea: area }) => {
                return (
                    bounds.x + bounds.width > area.x &&
                    bounds.x < area.x + area.width &&
                    bounds.y + bounds.height > area.y &&
                    bounds.y < area.y + area.height
                );
            });
        }

        return { open, get, close, raise, place, windowOf, optionsFor, dress, titlebarOf };
    }
);
