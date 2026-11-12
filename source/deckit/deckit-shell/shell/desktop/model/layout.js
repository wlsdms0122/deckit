import * as DOCK from '../../dock/model/dock.js';

// MARK: - Property
// A window's frame: the margin its shadow takes around it, as far as the key window's shadow reaches below it, the
// band outside its edge that resizes it, the rounding of its corners, and its title bar, where the window's buttons
// stand at its top left, centred on its height: `controlsWidth` the width they take from its start. The height is the
// kit's title bar's, so what a content lays in it is centred on the buttons.
const SHADOW = 48;
const EDGE = 6;
const RADIUS = 16;
const TITLE_BAR = Object.freeze({ height: 48, controlsWidth: 78 });
// The buttons in the title bar: close, minimize and zoom, their size, the room between them and their inset.
const BUTTONS = Object.freeze(['close', 'minimize', 'zoom']);
const BUTTON = Object.freeze({ size: 12, gap: 8, inset: 13 });
// A window is never smaller than its buttons and its title bar.
const MINIMUM = Object.freeze({ width: TITLE_BAR.controlsWidth + 42, height: TITLE_BAR.height });
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

// The minimum a window has: the one its mod gives, no smaller than its buttons and title bar.
function minimumOf({ width = 0, height = 0 } = {}) {
    return { width: Math.max(MINIMUM.width, width), height: Math.max(MINIMUM.height, height) };
}

// Where a new window `size` big opens: its `restored` frame, or cascaded from the top left of `after`, the frame of the
// window it follows, or centred on the desktop; kept where its title bar can be reached.
function placed({ size, restored = null, after = null, desktop }) {
    if (restored) return kept(restored, desktop);
    const area = zoomedIn(desktop);
    if (after) {
        const x = after.x + CASCADE;
        const y = after.y + CASCADE;
        const fits = x + size.width <= area.x + area.width && y + size.height <= area.y + area.height;
        return kept({ ...size, x: fits ? x : area.x + CASCADE, y: fits ? y : area.y + CASCADE }, desktop);
    }
    const x = area.x + Math.max(0, (area.width - size.width) / 2);
    const y = area.y + Math.max(0, (area.height - size.height) / 3);
    return kept({ ...size, x, y }, desktop);
}

// The frame moved so its title bar stays on the desktop, at least KEPT px of it across.
function kept({ x, y, width, height }, desktop) {
    const left = desktop.x + KEPT - width;
    const right = desktop.x + desktop.width - KEPT;
    const bottom = desktop.y + desktop.height - TITLE_BAR.height;
    return rounded({
        x: Math.min(right, Math.max(left, x)),
        y: Math.min(bottom, Math.max(desktop.y, y)),
        width,
        height,
    });
}

// The frames of panel windows `sizes` big, in the order they opened, in the host's bar `bar` high across a stage
// `width` wide: right to left from PANEL.margin in from its right end, PANEL.gap apart, each no higher than the bar
// and centred on its height.
function panelsIn(sizes, { width, bar }) {
    let right = width - PANEL.margin;
    return sizes.map((size) => {
        const across = Math.round(size.width);
        const height = Math.min(Math.round(size.height), bar);
        const frame = { x: right - across, y: Math.round((bar - height) / 2), width: across, height };
        right = frame.x - PANEL.gap;
        return frame;
    });
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

// The parts of a window's frame at `frame`: `rect`, the frame's own surface, grown by its shadow; `window`, the window
// in that surface; `edges`, the bands that resize it, each `{ edge, rect }` in the surface; `buttons`, the title bar's
// buttons' room, on the desktop; and `titleBar`, the guide the content is told, in the window.
function partsOf(frame) {
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
    const buttons = { x: frame.x, y: frame.y, width: TITLE_BAR.controlsWidth, height: TITLE_BAR.height };
    return { rect, window, edges, buttons, titleBar: { ...TITLE_BAR } };
}

// A titled window, one whose content draws no title bar of its own, has the shell's over it: the frame `size` big
// holds the content and that bar, and the content is laid in the frame below it.
function framedSize(size, titled) {
    return titled ? { width: size.width, height: size.height + TITLE_BAR.height } : size;
}

function contentOf(frame, titled) {
    if (!titled) return frame;
    return { ...frame, y: frame.y + TITLE_BAR.height, height: Math.max(0, frame.height - TITLE_BAR.height) };
}

// The title bar the shell draws for a titled window, in the frame's surface (partsOf `rect`).
function titleBarOf(frame) {
    return { x: SHADOW, y: SHADOW, width: frame.width, height: TITLE_BAR.height };
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
    MINIMUM,
    PANEL,
    desktopOf,
    zoomedIn,
    minimumOf,
    placed,
    kept,
    panelsIn,
    underBar,
    resized,
    partsOf,
    framedSize,
    contentOf,
    titleBarOf,
};
