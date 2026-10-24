function createWindow({ CONFIG, THEME }) {
    // MARK: - Property
    // The bar over a view laid below it, and the taller one over a view that fills the window, the bar's height
    // included, whose buttons stand in the panel's top left, inside the sidebar card while it is open. The buttons
    // are centred on the bar's height.
    const BAR = barOf({ height: 38, left: 14 });
    const FULL_SIZE_BAR = barOf({ height: 52, left: 20 });
    // The window's three buttons, from the first one's left edge to the last one's right.
    const BUTTONS_WIDTH = 52;
    // The bar over a view that fills the window: its height, and the width the buttons take from the window's left
    // edge, with as much room after them as before.
    const TITLE_BAR = Object.freeze({
        height: FULL_SIZE_BAR.height,
        controlsWidth: FULL_SIZE_BAR.buttons.x * 2 + BUTTONS_WIDTH,
    });
    const DEFAULT_VIEW_SIZE = { width: 1100, height: 722 };
    // The colour of Deckit.app's views, which a window's bar is drawn in too.
    const SAVE_DELAY = 400;
    const looks = new WeakMap(); // window -> { glass, covered }: how its bar page is drawn
    const titles = new WeakMap(); // window -> the title it shows
    const covered = new WeakSet(); // the windows whose view covers the bar, where its title would be
    // floating window -> { key, moved, timer }: the key it keeps where the person moved it to by, and whether they
    // moved it since it was last shown
    const floating = new WeakMap();

    // MARK: - Initializer
    // MARK: - Public
    // A window of Deckit.app: its own page is the bar, across the top and under everything else, and a view fills
    // the rest through `place(window, { bounds })`; `view`, when it is one page, is followed for its title. The bar
    // is the window's title bar to macOS, so it drags, snaps and answers a double click as the person set. `size`
    // is the view's, below the bar. `glass`, for a view drawn as glass, is the strength it lays its colour over the
    // blur at: the window blurs what is behind it, and the bar lays the same colour at the same strength, so the
    // two read as one surface. `fullSize`: the view fills the window, the bar's height included, and draws and
    // drags what lies under the bar itself (TITLE_BAR); the page below has no bar, and is clear under a glass view,
    // which lays its colour itself. A window with a `key` opens where it was last left; another opens over the window
    // in front. `focus` hands the keyboard to the view, which macOS otherwise gives the bar each time the window comes
    // forward.
    function open({
        view = null,
        title = '',
        size = null,
        glass = null,
        fullSize = false,
        key = null,
        place,
        focus = null,
    }) {
        const { BrowserWindow } = require('electron');
        const viewSize = size || DEFAULT_VIEW_SIZE;
        const bar = fullSize ? FULL_SIZE_BAR : BAR;
        const windowSize = { width: viewSize.width, height: viewSize.height + bar.height };
        const window = new BrowserWindow({
            ...windowSize,
            ...((key && savedBounds(key)) || overFront(windowSize)),
            title: title || CONFIG.name,
            show: false,
            // No colour with vibrancy: any colour, a clear one too, is laid over the blur. `hud` because macOS
            // offers only materials, and the others tint so much that the glass page over them reads as solid.
            ...(glass !== null
                ? { vibrancy: 'hud', visualEffectState: 'active' }
                : { backgroundColor: `rgb(${THEME.now().bar.background})` }),
            titleBarStyle: 'hidden',
            trafficLightPosition: bar.buttons,
        });
        const page = view?.webContents || null;
        const giveKeyboard = focus || (() => page && !page.isDestroyed() && page.focus());
        titles.set(window, title);
        if (fullSize) covered.add(window);
        looks.set(window, { glass, covered: fullSize });
        window.webContents.loadURL(barPage(looks.get(window)));
        window.webContents.on('did-finish-load', () => showTitle(window));
        place(window, { bounds: fullSize ? ({ width, height }) => ({ x: 0, y: 0, width, height }) : viewBounds });
        if (page) followPage(window, page);
        if (key) remember(window, key);
        window.on('focus', () => setImmediate(() => !window.isDestroyed() && window.isFocused() && giveKeyboard()));
        window.once('ready-to-show', () => window.show());
        return window;
    }

    // A window over every app, on every Space and over an app in full screen, that takes the keyboard without bringing
    // Deckit.app forward. It is clear and has no bar, so what is laid in it is all it draws, and it moves by what that
    // marks to drag. `size` is its own; where it was moved to is kept by `key`. `place(window)` puts a view in it, which
    // fills it; `focus` hands the view the keyboard as the window takes it, and `blur` hears it lose it. It opens
    // hidden: `float(window)` shows it.
    function openFloating({ size, key, place, focus, blur }) {
        const { BrowserWindow } = require('electron');
        const window = new BrowserWindow({
            ...size,
            type: 'panel',
            show: false,
            frame: false,
            transparent: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
        });
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
        place(window);
        keepMoves(window, key);
        window.on('focus', () => setImmediate(() => !window.isDestroyed() && window.isFocused() && focus()));
        window.on('blur', blur);
        return window;
    }

    // A floating window shown with the keyboard on the screen the pointer is on: where it was last moved to, when that
    // is on this screen, or else centred across it, a fifth of the way down.
    function float(window) {
        const { screen } = require('electron');
        const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
        const { width, height } = window.getBounds();
        const moving = floating.get(window);
        moving.moved = false;
        const kept = read()[moving.key];
        const inside =
            !!kept &&
            kept.x >= area.x &&
            kept.y >= area.y &&
            kept.x + width <= area.x + area.width &&
            kept.y + height <= area.y + area.height;
        const at = inside
            ? kept
            : { x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + area.height / 5) };
        window.setBounds({ x: at.x, y: at.y, width, height });
        window.show();
        window.focus();
    }

    // Where a view goes in the window: all of it below the bar.
    function viewBounds({ width, height }) {
        return { x: 0, y: BAR.height, width, height: Math.max(0, height - BAR.height) };
    }

    function setTitle(window, title) {
        if (window.isDestroyed()) return;
        titles.set(window, title);
        showTitle(window);
    }

    // MARK: - Private
    // The bar shows the latest title once it has loaded, whenever that came, unless the view covers it. macOS is
    // told it either way.
    function showTitle(window) {
        if (window.isDestroyed()) return;
        const title = titles.get(window) || '';
        window.setTitle(title || CONFIG.name);
        if (covered.has(window)) return;
        window.webContents.executeJavaScript(`setTitle(${JSON.stringify(title)})`, true).catch(() => {});
    }

    // A page in the window names it, and a site's page says which site it is, so a page cannot pass for another. The
    // page can outlive the window, so it stops being heard then.
    function followPage(window, page) {
        const titled = (_event, text) => setTitle(window, labelOf(page, text));
        page.on('page-title-updated', titled);
        window.once('closed', () => page.isDestroyed() || page.removeListener('page-title-updated', titled));
    }

    function labelOf(page, title) {
        let site = '';
        try {
            const url = new URL(page.getURL());
            if (url.protocol === 'http:' || url.protocol === 'https:') site = url.host;
        } catch {}
        return site && title !== site ? `${title} (${site})` : title;
    }

    // Kept as the person moves it, and only then: `will-move` comes before a move they make, and never before one
    // `setBounds` makes.
    function keepMoves(window, key) {
        const moving = { key, moved: false, timer: null };
        floating.set(window, moving);
        window.on('will-move', () => (moving.moved = true));
        window.on('move', () => {
            if (!moving.moved) return;
            clearTimeout(moving.timer);
            moving.timer = setTimeout(
                () => !window.isDestroyed() && write({ ...read(), [key]: window.getBounds() }),
                SAVE_DELAY
            );
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

    function barOf({ height, left }) {
        return Object.freeze({ height, buttons: Object.freeze({ x: left, y: Math.round((height - 14) / 2) }) });
    }

    // The bar's room on the left is the window buttons'; the title stays centred on the window. Under a view that
    // covers it the page has no bar: a region it marked to drag would drag the window through the view, whatever the
    // view drew there.
    function barPage({ glass, covered }) {
        const { bar: colour } = THEME.now();
        const background =
            glass === null
                ? `rgb(${colour.background})`
                : covered
                  ? 'transparent'
                  : `rgba(${colour.background}, ${glass})`;
        const page = `html,body{margin:0;height:100%;overflow:hidden;background:${background};cursor:default;-webkit-user-select:none;user-select:none}`;
        const bar = `
#bar{position:absolute;left:0;right:0;top:0;height:${BAR.height}px;display:flex;align-items:center;justify-content:center;padding:0 88px;box-sizing:border-box;-webkit-app-region:drag;color:${colour.color};font:600 13px ${THEME.FONT}}
#title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.7}
</style><div id="bar"><span id="title"></span></div><script>
window.setTitle = (text) => { document.getElementById('title').textContent = text; };
</script>`;
        return (
            'data:text/html,' +
            encodeURIComponent(`<!doctype html><meta charset="utf-8"><style>${page}${covered ? '</style>' : bar}`)
        );
    }

    // The system's appearance changed: every window's bar, and the colour under a solid one, are drawn again in it.
    function recolor() {
        const { BrowserWindow } = require('electron');
        for (const window of BrowserWindow.getAllWindows()) {
            const look = looks.get(window);
            if (!look) continue;
            if (look.glass === null) window.setBackgroundColor(`rgb(${THEME.now().bar.background})`);
            window.webContents.loadURL(barPage(look));
        }
    }

    return { open, openFloating, float, viewBounds, titleBar: TITLE_BAR, setTitle, recolor };
}

module.exports = { createWindow };
