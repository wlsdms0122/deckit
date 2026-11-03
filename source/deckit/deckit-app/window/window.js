function createWindow({ CONFIG, THEME, windows }) {
    // MARK: - Property
    // The bar over a view that fills the window, the bar's height included, whose buttons stand in the panel's top
    // left, inside the sidebar card while it is open. The buttons are centred on the bar's height.
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
    // A window of Deckit.app, with macOS's title bar across its top, drawn in the bar's colour, and a view below it,
    // all of the window's content, through `place(window)`. The bar is the window's own, laid as macOS lays it, so
    // it drags, snaps and answers a double click as the person set. `size` is the view's. `glass`, for a view drawn as
    // glass: the window blurs what is behind it instead. `fullSize`: the view fills the window, the bar's height
    // included, and draws and drags what lies under the bar itself (TITLE_BAR), the title not drawn. A window with a
    // `key` opens where it was last left; another opens over the window in front. `focus` hands the keyboard to the
    // view as the window takes it.
    function open({ title = '', size = null, glass = null, fullSize = false, key = null, place, focus = null }) {
        const viewSize = size || DEFAULT_VIEW_SIZE;
        const windowSize = fullSize
            ? { width: viewSize.width, height: viewSize.height + FULL_SIZE_BAR.height }
            : viewSize;
        const window = windows().open({
            kind: 'titled',
            size: windowSize,
            frame: (key && savedFrame(key)) || overFront(windowSize),
            title: title || CONFIG.name,
            showsTitle: !fullSize,
            ...(glass !== null ? { material: 'hud' } : { color: colourOf(THEME.now().bar.background) }),
            ...(fullSize ? { buttons: FULL_SIZE_BAR.buttons } : {}),
        });
        if (glass === null) {
            solid.add(window);
            window.on('close', () => solid.delete(window));
        }
        if (fullSize) covered.add(window);
        place(window);
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

    // Gives a window's view `size`, and the bar's height with it in a window whose view fills it.
    function setViewSize(window, { width, height }) {
        window.setSize({ width, height: height + (covered.has(window) ? FULL_SIZE_BAR.height : 0) });
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
        return overFront(size) || centred(screen.getPrimaryDisplay().workArea, size);
    }

    // Centred over the window in front, where the person was when it was asked for, on its display.
    function overFront(size) {
        const at = windows().focused()?.frame();
        if (!at) return null;
        return centred(require('electron').screen.getDisplayMatching(at).workArea, size, at);
    }

    // `size` centred over `over`, the whole of `area` where none is given, and kept inside `area`: cut to it, and
    // moved in where it would lie past an edge.
    function centred(area, size, over = area) {
        const width = Math.min(size.width, area.width);
        const height = Math.min(size.height, area.height);
        const x = Math.round(over.x + (over.width - width) / 2);
        const y = Math.round(over.y + Math.max(0, (over.height - height) / 2));
        return {
            x: Math.min(Math.max(x, area.x), area.x + area.width - width),
            y: Math.min(Math.max(y, area.y), area.y + area.height - height),
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

    return { open, openFloating, float, setViewSize, titleBar: TITLE_BAR, setTitle, recolor };
}

module.exports = { createWindow };
