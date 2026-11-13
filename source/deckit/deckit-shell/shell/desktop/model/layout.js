import * as DOCK from '../../dock/model/dock.js';

// MARK: - Property
// A window's frame: the margin its shadow takes around it, as far as the key window's shadow reaches below it, the
// band outside its edge that resizes it, the rounding of its corners, and its title bar's height where its mod gives
// none, the kit's title bar's, a 32 control with 8 above and below.
const SHADOW = 48;
const EDGE = 6;
const RADIUS = 16;
const TITLE_BAR = Object.freeze({ height: 48 });
// The buttons in the title bar: close, minimize and zoom, their size and the room between them; the group's width; how
// far in from the frame's left they stand where the mod gives no origin, as far as they stand down in the default bar;
// and the room a window keeps past the title bar area's start.
const BUTTONS = Object.freeze(['close', 'minimize', 'zoom']);
const BUTTON = Object.freeze({ size: 12, gap: 8 });
const GROUP = BUTTONS.length * BUTTON.size + (BUTTONS.length - 1) * BUTTON.gap;
const INSET = (TITLE_BAR.height - BUTTON.size) / 2;
const ROOM = 42;
// The title bar of a window opened with no options of its own.
const DEFAULT_BAR = barOf();
// A window is never smaller than its buttons with room past them and its title bar.
const MINIMUM = Object.freeze({ width: DEFAULT_BAR.areaX + ROOM, height: TITLE_BAR.height });
// How far a new window stands from the key window.
const CASCADE = 24;
// How much of a window's title bar stays on the desktop, so it can always be dragged back.
const KEPT = 64;
// Where panel windows stand in the host's bar: in from its right end, and apart.
const PANEL = Object.freeze({ margin: 8, gap: 8 });

// MARK: - Initializer
// MARK: - Public
// The desktop in a stage of `size` with `strip` px at its top for the host's bar: where windows are.
function desktopOf(size, strip) {
    return { x: 0, y: strip, width: size.width, height: Math.max(0, size.height - strip) };
}

// Where a zoomed window goes: the desktop but the Dock's sliver.
function zoomedIn(desktop) {
    return { ...desktop, x: desktop.x + DOCK.SLIVER, width: Math.max(0, desktop.width - DOCK.SLIVER) };
}

// A window's title bar from what it opened with: `style` 'unified', the content under a transparent bar that is its
// toolbar, or 'titled', the bar the shell draws with the window's title over the content; `height`; `origin` `{ x, y }`
// where the buttons' group stands from the frame's top left, each left out for the default, INSET in and centred on
// the height, a `y` past the bar's bottom standing it there; and `enabled`, whether each button acts. `areaX` is
// where the title bar area starts, one gap past the group.
function barOf({ style = 'unified', height = TITLE_BAR.height, origin = {}, enabled = {} } = {}) {
    const lowest = height - BUTTON.size;
    const x = Math.round(Math.max(0, origin.x ?? INSET));
    const y = Math.round(Math.min(lowest, Math.max(0, origin.y ?? lowest / 2)));
    const on = Object.fromEntries(BUTTONS.map((name) => [name, enabled[name] !== false]));
    return Object.freeze({ style, height, x, y, areaX: x + GROUP + BUTTON.gap, enabled: Object.freeze(on) });
}

// The minimum a window has: the one its mod gives, no smaller than its buttons with ROOM past them and its title bar.
function minimumOf({ width = 0, height = 0 } = {}, bar = DEFAULT_BAR) {
    return { width: Math.max(bar.areaX + ROOM, width), height: Math.max(bar.height, height) };
}

// Where a new window `size` big opens: its `restored` frame, or cascaded from the top left of `after`, the frame of the
// window it follows, or centred on the desktop; kept where its title bar can be reached.
function placed({ size, restored = null, after = null, desktop, bar = TITLE_BAR.height }) {
    if (restored) return kept(restored, desktop, bar);
    const area = zoomedIn(desktop);
    if (after) {
        const x = after.x + CASCADE;
        const y = after.y + CASCADE;
        const fits = x + size.width <= area.x + area.width && y + size.height <= area.y + area.height;
        return kept({ ...size, x: fits ? x : area.x + CASCADE, y: fits ? y : area.y + CASCADE }, desktop, bar);
    }
    const x = area.x + Math.max(0, (area.width - size.width) / 2);
    const y = area.y + Math.max(0, (area.height - size.height) / 3);
    return kept({ ...size, x, y }, desktop, bar);
}

// The frame moved so its title bar, `bar` high, stays on the desktop, at least KEPT px of it across.
function kept({ x, y, width, height }, desktop, bar = TITLE_BAR.height) {
    const left = desktop.x + KEPT - width;
    const right = desktop.x + desktop.width - KEPT;
    const bottom = desktop.y + desktop.height - bar;
    return rounded({
        x: Math.min(right, Math.max(left, x)),
        y: Math.min(bottom, Math.max(desktop.y, y)),
        width,
        height,
    });
}

// The frames of panel windows, each `{ edge, size }`, in the order they opened, in a stage `width` by `height` with the
// host's bar `bar` high across its top. Those at the edge `top` stand in the bar right to left from PANEL.margin in
// from its right end, PANEL.gap apart, each no higher than the bar and centred on its height; those at the edge
// `right` stand along the desktop's right edge right to left the same way, each its width wide and as tall as the
// desktop but PANEL.margin above and below. Any other edge is `top`.
function panelsIn(panels, { width, height, bar }) {
    const right = { top: width - PANEL.margin, right: width - PANEL.margin };
    const tall = Math.max(0, height - bar - 2 * PANEL.margin);
    return panels.map(({ edge, size }) => {
        const side = edge === 'right' ? 'right' : 'top';
        const across = Math.round(size.width);
        const high = side === 'right' ? tall : Math.min(Math.round(size.height), bar);
        const y = side === 'right' ? bar + PANEL.margin : Math.round((bar - high) / 2);
        const frame = { x: right[side] - across, y, width: across, height: high };
        right[side] = frame.x - PANEL.gap;
        return frame;
    });
}

// The rounding of a panel window's frame at `edge`: a capsule in the bar, a window's corners along the right edge.
function panelRadius(edge, frame) {
    return edge === 'right' ? RADIUS : frame.height / 2;
}

// The frame as a drag leaves it while it goes, kept under the host's bar: one moved stays below it, and one whose top
// edge is dragged stops there.
function underBar({ x, y, width, height }, desktop, { moved }) {
    if (y >= desktop.y) return { x, y, width, height };
    if (moved) return { x, y: desktop.y, width, height };
    return { x, y: desktop.y, width, height: Math.max(0, height - (desktop.y - y)) };
}

// The frame `from` resized by a drag of its `edge` by `dx`, `dy`: `edge` names the sides it moves, of `top`,
// `bottom`, `left`, `right`, as `top-left`. The opposite side stays put at the minimum.
function resized(from, edge, dx, dy, minimum) {
    const sides = new Set(edge.split('-'));
    let { x, y, width, height } = from;
    if (sides.has('right')) width = Math.max(minimum.width, from.width + dx);
    if (sides.has('bottom')) height = Math.max(minimum.height, from.height + dy);
    if (sides.has('left')) {
        width = Math.max(minimum.width, from.width - dx);
        x = from.x + from.width - width;
    }
    if (sides.has('top')) {
        height = Math.max(minimum.height, from.height - dy);
        y = from.y + from.height - height;
    }
    return rounded({ x, y, width, height });
}

// The parts of a window's frame at `frame` with the title bar `bar`: `rect`, the frame's own surface, grown by its
// shadow; `window`, the window in that surface; `edges`, the bands that resize it, each `{ edge, rect }` in the
// surface; and `buttons`, the room of the title bar's buttons, on the desktop, the bar up to its area.
function partsOf(frame, bar = DEFAULT_BAR) {
    const rect = {
        x: frame.x - SHADOW,
        y: frame.y - SHADOW,
        width: frame.width + 2 * SHADOW,
        height: frame.height + 2 * SHADOW,
    };
    const window = { x: SHADOW, y: SHADOW, width: frame.width, height: frame.height };
    const outer = SHADOW - EDGE;
    const band = (edge, x, y, width, height) => ({ edge, rect: { x, y, width, height } });
    const far = { x: SHADOW + frame.width, y: SHADOW + frame.height };
    const edges = [
        band('top', SHADOW, outer, frame.width, EDGE),
        band('bottom', SHADOW, far.y, frame.width, EDGE),
        band('left', outer, SHADOW, EDGE, frame.height),
        band('right', far.x, SHADOW, EDGE, frame.height),
        band('top-left', outer, outer, EDGE, EDGE),
        band('top-right', far.x, outer, EDGE, EDGE),
        band('bottom-left', outer, far.y, EDGE, EDGE),
        band('bottom-right', far.x, far.y, EDGE, EDGE),
    ];
    const buttons = { x: frame.x, y: frame.y, width: bar.areaX, height: bar.height };
    return { rect, window, edges, buttons };
}

// Each button's room in the buttons' surface, `{ name, x, y, width, height }`, in their order.
function buttonsOf(bar = DEFAULT_BAR) {
    const { size, gap } = BUTTON;
    return BUTTONS.map((name, at) => ({ name, x: bar.x + at * (size + gap), y: bar.y, width: size, height: size }));
}

// What the content of a window with the title bar `bar` is told of it, `{ height, controlsWidth }`, where the buttons
// stand over its top and the title bar area starts; or null, for content under no bar of the shell's.
function guideOf(bar) {
    return bar && bar.style !== 'titled' ? { height: bar.height, controlsWidth: bar.areaX } : null;
}

// A titled window has the shell's title bar over its content: the frame `size` big holds the content and that bar, and
// the content is laid in the frame below it.
function framedSize(size, bar = DEFAULT_BAR) {
    return bar.style === 'titled' ? { width: size.width, height: size.height + bar.height } : size;
}

function contentOf(frame, bar = DEFAULT_BAR) {
    if (bar.style !== 'titled') return frame;
    return { ...frame, y: frame.y + bar.height, height: Math.max(0, frame.height - bar.height) };
}

// The title bar the shell draws for a titled window, in the frame's surface (partsOf `rect`).
function titleBarOf(frame, bar = DEFAULT_BAR) {
    return { x: SHADOW, y: SHADOW, width: frame.width, height: bar.height };
}

// MARK: - Private
function rounded({ x, y, width, height }) {
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export {
    SHADOW,
    EDGE,
    RADIUS,
    TITLE_BAR,
    BUTTONS,
    BUTTON,
    DEFAULT_BAR,
    MINIMUM,
    PANEL,
    barOf,
    buttonsOf,
    guideOf,
    desktopOf,
    zoomedIn,
    minimumOf,
    placed,
    kept,
    panelsIn,
    panelRadius,
    underBar,
    resized,
    partsOf,
    framedSize,
    contentOf,
    titleBarOf,
};
