function createWindow({ CONFIG, THEME, windows }) {
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
    const SAVE_DELAY = 400;
    const solid = new Set(); // the open windows drawn in the bar's colour, which follow the system's appearance
    const covered = new WeakSet(); // the windows whose view covers the bar
    // floating window -> { key, moved, timer }: the key it keeps where the person moved it to by, and whether they
    // moved it since it was last shown
    const floating = new WeakMap();

    // MARK: - Initializer
    // MARK: - Public
    // A window of Deckit.app, with macOS's title bar across its top, drawn in the bar's colour, and a view below it
    // through `place(window, { bounds })`. The bar is the window's own, so it drags, snaps and answers a double click
    // as the person set. `size` is the view's, below the bar. `glass`, for a view drawn as glass: the window blurs what
    // is behind it instead. `fullSize`: the view fills the window, the bar's height included, and draws and drags what
    // lies under the bar itself (TITLE_BAR), the title not drawn. A window with a `key` opens where it was last left;
    // another opens over the window in front. `focus` hands the keyboard to the view as the window takes it.
    function open({ title = '', size = null, glass = null, fullSize = false, key = null, place, focus = null }) {
        const viewSize = size || DEFAULT_VIEW_SIZE;
        const bar = fullSize ? FULL_SIZE_BAR : BAR;
        const windowSize = { width: viewSize.width, height: viewSize.height + bar.height };
        const window = windows().open({
            kind: 'titled',
            size: windowSize,
            frame: (key && savedFrame(key)) || overFront(windowSize),
            title: title || CONFIG.name,
            showsTitle: !fullSize,
            ...(glass !== null ? { material: 'hud' } : { color: colourOf(THEME.now().bar.background) }),
            buttons: bar.buttons,
        });
        if (glass === null) {
            solid.add(window);
            window.on('close', () => solid.delete(window));
        }
        if (fullSize) covered.add(window);
        place(window, { bounds: fullSize ? null : viewBounds });
        if (key) remember(window, key);
        if (focus) window.on('key', () => setImmediate(() => window.isKey() && focus()));
        window.show({ focus: true });
        return window;
    }

    // A window over every app, on every Space and over an app in full screen, that takes the keyboard without bringing
    // Deckit.app forward. It blurs what is behind it, macOS draws its edge, and it has no bar, so what is laid in it,
    // as glass, is all it draws, and it moves by what that marks to drag. `size` is its own; where it was moved to is
    // kept by `key`. `place(window)` puts a view in it, which fills it; `focus` hands the view the keyboard as the
    // window takes it, and `blur` hears it lose it. It opens hidden: `float(window)` shows it.
    function openFloating({ size, key, place, focus, blur }) {
        const window = windows().open({ kind: 'floating', size, material: 'hud' });
        place(window);
        keepMoves(window, key);
        window.on('key', () => setImmediate(() => window.isKey() && focus()));
        window.on('resign', () => blur());
        return window;
    }

    // A floating window shown with the keyboard on the screen the pointer is on: where it was last moved to, when that
    // is on this screen, or else centred across it, a fifth of the way down.
    function float(window) {
        const { screen } = require('electron');
        const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
        const { width, height } = window.frame();
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
        window.setFrame({ x: at.x, y: at.y, width, height });
        window.show({ focus: true });
    }

    // Where a view goes in the window: all of it below the bar.
    function viewBounds({ width, height }) {
        return { x: 0, y: BAR.height, width, height: Math.max(0, height - BAR.height) };
    }

    // Gives a window's view `size`: below the bar in a window with one, the whole of a floating one.
    function setViewSize(window, { width, height }) {
        const bar = floating.has(window) ? null : covered.has(window) ? FULL_SIZE_BAR : BAR;
        window.setSize({ width, height: height + (bar?.height || 0) });
    }

    function setTitle(window, title) {
        window.setTitle(title || CONFIG.name);
    }

    // The system's appearance changed: the colour under every solid window is drawn again in it.
    function recolor() {
        for (const window of solid) window.setColor(colourOf(THEME.now().bar.background));
    }

    // MARK: - Private
    // Kept as the person moves it, and only then: `moving` comes before a move they make, and never before one
    // `setFrame` makes.
    function keepMoves(window, key) {
        const moving = { key, moved: false, timer: null };
        floating.set(window, moving);
        window.on('moving', () => (moving.moved = true));
        window.on('moved', () => {
            if (!moving.moved) return;
            clearTimeout(moving.timer);
            moving.timer = setTimeout(
                () => !window.isClosed() && write({ ...read(), [key]: window.frame() }),
                SAVE_DELAY
            );
        });
    }

    // Kept as it moves, and as it closes in case that came first: where it was left as the person placed it, never
    // full screen or zoomed.
    function remember(window, key) {
        let timer = null;
        let frame = window.frame();
        const save = () => write({ ...read(), [key]: frame });
        const later = () => {
            if (window.isFullScreen() || window.isZoomed()) return;
            frame = window.frame();
            clearTimeout(timer);
            timer = setTimeout(save, SAVE_DELAY);
        };
        window.on('resize', later);
        window.on('moved', later);
        window.on('close', () => {
            clearTimeout(timer);
            save();
        });
    }

    // Where the window was left, or its size over the window in front, or else centred on the main display, when that
    // place is on a display no longer attached.
    function savedFrame(key) {
        const frame = read()[key];
        if (!frame) return null;
        const { screen } = require('electron');
        const onScreen = screen.getAllDisplays().some(({ workArea: area }) => {
            return (
                frame.x + frame.width > area.x &&
                frame.x < area.x + area.width &&
                frame.y + frame.height > area.y &&
                frame.y < area.y + area.height
            );
        });
        if (onScreen) return frame;
        const size = { width: frame.width, height: frame.height };
        const area = screen.getPrimaryDisplay().workArea;
        return (
            overFront(size) || {
                x: Math.round(area.x + (area.width - size.width) / 2),
                y: Math.round(area.y + Math.max(0, (area.height - size.height) / 2)),
                ...size,
            }
        );
    }

    // Centred over the window in front, where the person was when it was asked for.
    function overFront({ width, height }) {
        const at = windows().focused()?.frame();
        if (!at) return null;
        return {
            x: Math.round(at.x + (at.width - width) / 2),
            y: Math.round(at.y + Math.max(0, (at.height - height) / 2)),
            width,
            height,
        };
    }

    function colourOf([red, green, blue]) {
        return { red, green, blue };
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

    return { open, openFloating, float, viewBounds, setViewSize, titleBar: TITLE_BAR, setTitle, recolor };
}

module.exports = { createWindow };
