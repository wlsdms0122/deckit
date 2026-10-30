import * as WIDTH from './width.js';

// MARK: - Property
// The card's inset from the panel's edges, and how far the handle stands past it, over the content's edge.
const INSET = 8;
const HANDLE_OUT = 6;
const HANDLE = Object.freeze({ width: 16, height: 64 });
// Folded, the handle stays at the panel's edge, this far in.
const HANDLE_FOLDED = 3;

// MARK: - Initializer
// MARK: - Public
// Where the frame's parts are in a panel of `size`, with the window's `titleBar` over its top, the sidebar `width`
// wide or `collapsed`, and the slot under the list `slot.top` below the card's inside top and `slot.bottom` above its
// bottom. `card` is the sidebar's card and `drawn` its width open, which what it holds keeps while it folds; the rest,
// rounded: `sidebar`, the slot lent to the mod's sidebar; `content`, the room beside the sidebar; `handle`, the width's
// handle; `obscured`, what the frame's page covers over the mod on screen, the window's buttons among it.
function laidOut({ size, titleBar, width, collapsed, slot }) {
    const drawn = WIDTH.fitted(width, size.width);
    const inset = collapsed ? 0 : INSET;
    const card = { x: inset, y: INSET, width: collapsed ? 0 : drawn, height: Math.max(0, size.height - 2 * INSET) };
    const border = collapsed ? 0 : 1;
    const sidebar = {
        x: card.x + border,
        y: card.y + border + slot.top,
        width: Math.max(0, card.width - 2 * border),
        height: Math.max(0, card.height - 2 * border - slot.top - slot.bottom),
    };
    const contentX = collapsed ? 0 : card.x + card.width + INSET;
    const content = { x: contentX, y: 0, width: Math.max(0, size.width - contentX), height: size.height };
    const handle = {
        x: collapsed ? HANDLE_FOLDED : contentX + HANDLE_OUT - HANDLE.width / 2,
        y: (size.height - HANDLE.height) / 2,
        ...HANDLE,
    };
    const obscured = {
        x: 0,
        y: 0,
        width: Math.max(collapsed ? 0 : card.x + card.width, titleBar?.controlsWidth || 0),
        height: Math.max(collapsed ? 0 : sidebar.y, titleBar?.height || 0),
    };
    return {
        collapsed,
        drawn,
        card,
        sidebar: rounded(sidebar),
        content: rounded(content),
        handle: rounded(handle),
        obscured: rounded(obscured),
    };
}

// How far down the card holds what it lists, under the window's `titleBar`.
function barRoom(titleBar) {
    return titleBar ? Math.max(0, titleBar.height - INSET) : 0;
}

// MARK: - Private
function rounded({ x, y, width, height }) {
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export { barRoom, laidOut };
