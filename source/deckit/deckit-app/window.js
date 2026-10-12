DeckitModule.define(
    'app/window',
    {
        uses: ['deckit/config'],
        provides: ['open', 'area', 'setTitle'],
        runs: 'main',
    },
    (CONFIG) => {
        // MARK: - Property
        const BAR_HEIGHT = 38;
        const BUTTONS_AT = { x: 14, y: Math.round((BAR_HEIGHT - 14) / 2) };
        const DEFAULT_SIZE = { width: 1100, height: 760 };
        const SOLID = { background: '#1a1d21', color: '#d1d2d3' };
        const FONT = '-apple-system, system-ui, sans-serif';
        const SAVE_DELAY = 400;

        // MARK: - Initializer
        // MARK: - Public
        // A window of Deckit.app: its own page is the bar, across the top and under everything else, and `view` fills
        // the rest through `place`. The bar is the window's title bar to macOS, so it drags, snaps and answers a double
        // click as the person set. `glass` blurs what is behind the window, for a view drawn as glass; the bar is then
        // clear, so the two read as one surface. A window with a `name` opens where it was last left.
        function open({ view, title = '', size = null, glass = false, name = null, place, onClose = null }) {
            const { BrowserWindow } = require('electron');
            const saved = name ? boundsOf(name) : null;
            const window = new BrowserWindow({
                ...DEFAULT_SIZE,
                ...size,
                ...saved,
                title: title || CONFIG.name,
                show: false,
                // No colour with vibrancy: any colour, a clear one too, is laid over the blur. `hud` because macOS
                // offers only materials, and the others tint so much that the glass page over them reads as solid.
                ...(glass ? { vibrancy: 'hud', visualEffectState: 'active' } : { backgroundColor: SOLID.background }),
                titleBarStyle: 'hidden',
                trafficLightPosition: BUTTONS_AT,
            });
            window.webContents.loadURL(barPage({ glass }));
            window.webContents.once('did-finish-load', () => setTitle(window, title));
            place(view, window, { bounds: area, onClose });
            if (view.webContents) followTitle(window, view.webContents);
            if (name) remember(window, name);
            window.once('ready-to-show', () => window.show());
            return window;
        }

        // Where a view goes in the window: all of it below the bar.
        function area({ width, height }) {
            return { x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) };
        }

        function setTitle(window, title) {
            if (window.isDestroyed()) return;
            window.setTitle(title || CONFIG.name);
            window.webContents
                .executeJavaScript(`setTitle(${JSON.stringify(String(title || ''))})`, true)
                .catch(() => {});
        }

        // MARK: - Private
        // The page's title becomes the window's. The page can outlive the window, so it stops being heard then.
        function followTitle(window, page) {
            const titled = (_event, text) => setTitle(window, text);
            page.on('page-title-updated', titled);
            window.once('closed', () => page.isDestroyed() || page.removeListener('page-title-updated', titled));
        }

        // Kept as it moves, not on close: a quit can take the window without a close event.
        function remember(window, name) {
            let timer = null;
            const save = () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (!window.isDestroyed()) write({ ...read(), [name]: window.getNormalBounds() });
                }, SAVE_DELAY);
            };
            window.on('resize', save);
            window.on('move', save);
        }

        // Where the window was left, or only its size when that place is on a display no longer attached.
        function boundsOf(name) {
            const bounds = read()[name];
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

        return { open, area, setTitle };
    }
);
