DeckitModule.define(
    'app/window',
    {
        uses: ['app/config'],
        provides: ['open', 'viewBounds', 'setTitle'],
        runs: 'main',
    },
    (CONFIG) => {
        // MARK: - Property
        const BAR_HEIGHT = 38;
        const BUTTONS_AT = { x: 14, y: Math.round((BAR_HEIGHT - 14) / 2) };
        const DEFAULT_VIEW_SIZE = { width: 1100, height: 722 };
        const SOLID = { background: '#1a1d21', color: '#d1d2d3' };
        const FONT = '-apple-system, system-ui, sans-serif';
        const SAVE_DELAY = 400;
        const titles = new WeakMap(); // window -> the title it shows

        // MARK: - Initializer
        // MARK: - Public
        // A window of Deckit.app: its own page is the bar, across the top and under everything else, and `view` fills
        // the rest through `place(window, { bounds })`. The bar is the window's title bar to macOS, so it drags, snaps and
        // answers a double click as the person set. `size` is the view's. `glass` blurs what is behind the window, for
        // a view drawn as glass; the bar is then clear, so the two read as one surface. A window with a `key` opens
        // where it was last left; another opens over the window in front. `focus` hands the keyboard to the view, which
        // macOS otherwise gives the bar each time the window comes forward.
        function open({ view, title = '', size = null, glass = false, key = null, place, focus = null }) {
            const { BrowserWindow } = require('electron');
            const viewSize = size || DEFAULT_VIEW_SIZE;
            const windowSize = { width: viewSize.width, height: viewSize.height + BAR_HEIGHT };
            const window = new BrowserWindow({
                ...windowSize,
                ...((key && savedBounds(key)) || overFront(windowSize)),
                title: title || CONFIG.name,
                show: false,
                // No colour with vibrancy: any colour, a clear one too, is laid over the blur. `hud` because macOS
                // offers only materials, and the others tint so much that the glass page over them reads as solid.
                ...(glass ? { vibrancy: 'hud', visualEffectState: 'active' } : { backgroundColor: SOLID.background }),
                titleBarStyle: 'hidden',
                trafficLightPosition: BUTTONS_AT,
            });
            const page = view.webContents || null;
            const giveKeyboard = focus || (() => page && !page.isDestroyed() && page.focus());
            titles.set(window, title);
            window.webContents.loadURL(barPage({ glass }));
            window.webContents.on('did-finish-load', () => showTitle(window));
            place(window, { bounds: viewBounds });
            if (page) followPage(window, page);
            if (key) remember(window, key);
            window.on('focus', () => setImmediate(() => !window.isDestroyed() && window.isFocused() && giveKeyboard()));
            window.once('ready-to-show', () => window.show());
            return window;
        }

        // Where a view goes in the window: all of it below the bar.
        function viewBounds({ width, height }) {
            return { x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) };
        }

        function setTitle(window, title) {
            if (window.isDestroyed()) return;
            titles.set(window, title);
            showTitle(window);
        }

        // MARK: - Private
        // The bar shows the latest title once it has loaded, whenever that came.
        function showTitle(window) {
            if (window.isDestroyed()) return;
            const title = titles.get(window) || '';
            window.setTitle(title || CONFIG.name);
            window.webContents.executeJavaScript(`setTitle(${JSON.stringify(title)})`, true).catch(() => {});
        }

        // A page in the window names it, and moves and sizes it when it asks to. The page can outlive the window, so
        // it stops being heard then.
        function followPage(window, page) {
            const titled = (_event, text) => setTitle(window, text);
            const moved = (_event, bounds) => {
                if (!window.isDestroyed()) window.setContentBounds({ ...bounds, height: bounds.height + BAR_HEIGHT });
            };
            page.on('page-title-updated', titled);
            page.on('content-bounds-updated', moved);
            window.once('closed', () => {
                if (page.isDestroyed()) return;
                page.removeListener('page-title-updated', titled);
                page.removeListener('content-bounds-updated', moved);
            });
        }

        // Kept as it moves, and as it closes in case that came first.
        function remember(window, key) {
            let timer = null;
            const save = () => !window.isDestroyed() && write({ ...read(), [key]: window.getNormalBounds() });
            const later = () => {
                clearTimeout(timer);
                timer = setTimeout(save, SAVE_DELAY);
            };
            window.on('resize', later);
            window.on('move', later);
            window.on('close', () => {
                clearTimeout(timer);
                save();
            });
        }

        // Where the window was left, or only its size when that place is on a display no longer attached.
        function savedBounds(key) {
            const bounds = read()[key];
            if (!bounds) return null;
            const { screen } = require('electron');
            const onScreen = screen.getAllDisplays().some(({ workArea: area }) => {
                return (
                    bounds.x + bounds.width > area.x &&
                    bounds.x < area.x + area.width &&
                    bounds.y + bounds.height > area.y &&
                    bounds.y < area.y + area.height
                );
            });
            return onScreen ? bounds : { width: bounds.width, height: bounds.height };
        }

        // Centred over the window in front, where the person was when it was asked for.
        function overFront({ width, height }) {
            const front = require('electron').BrowserWindow.getFocusedWindow();
            if (!front) return {};
            const at = front.getBounds();
            return {
                x: Math.round(at.x + (at.width - width) / 2),
                y: Math.round(at.y + Math.max(0, (at.height - height) / 2)),
            };
        }

        function file() {
            const path = require('path');
            return path.join(require('electron').app.getPath('userData'), 'windows.json');
        }

        function read() {
            try {
                return JSON.parse(require('fs').readFileSync(file(), 'utf8'));
            } catch {
                return {};
            }
        }

        function write(all) {
            const fs = require('fs');
            const temporary = file() + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(all));
            fs.renameSync(temporary, file());
        }

        // The bar's room on the left is the window buttons'; the title stays centred on the window.
        function barPage({ glass }) {
            const background = glass ? 'transparent' : SOLID.background;
            return (
                'data:text/html,' +
                encodeURIComponent(`<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:${background};cursor:default;-webkit-user-select:none;user-select:none}
#bar{position:absolute;left:0;right:0;top:0;height:${BAR_HEIGHT}px;display:flex;align-items:center;justify-content:center;padding:0 88px;box-sizing:border-box;-webkit-app-region:drag;color:${SOLID.color};font:600 13px ${FONT}}
#title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.7}
</style><div id="bar"><span id="title"></span></div><script>
window.setTitle = (text) => { document.getElementById('title').textContent = text; };
</script>`)
            );
        }

        return { open, viewBounds, setTitle };
    }
);
