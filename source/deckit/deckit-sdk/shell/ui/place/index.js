import * as LAYER from '../layer/index.js';

// MARK: - Property
// What floats in the page over its own fixed things: a float (a toolbar, an autocomplete) and, above all of it, what a
// drag draws there.
const Z = Object.freeze({ float: 1150, drag: 2147483646 });
// How far inside the window a placed box stays.
const MARGIN = 8;
// How far a submenu overlaps the menu it opens from.
const OVERLAP = 6;
// A list that fits its room: how far from the window's edge it ends, how tall it grows at most, and the room under
// its target below which it opens above, where there is more room there.
const FIT = Object.freeze({ edge: 16, tallest: 480, low: 160 });

// MARK: - Initializer
// MARK: - Public
// Places a fixed box against a target, kept MARGIN inside the viewport of the target's document (the box's for a
// point or a rect; the page's for its overlay), and returns the side it went to.
// - `anchor` (an element) or `rect`: below it, or above when only that fits. `align` is `start` or `center`.
// - `point`: at it, or above it.
// - `beside` (a row of a menu): right of the menu, overlapping it, or left of it when only that fits.
// `prefer` puts a box above its target first. With `fit`, a list (a menu) is as tall as the room on its side allows,
// FIT.edge inside the window and FIT.tallest at most, scrolling inside past that, and opens above its target or point
// where it does not fit below, the room there is under FIT.low and the room above is larger. A placed box takes
// presses where it lies, over a part of the page that drags the window too.
function place(
    element,
    {
        anchor = null,
        rect = null,
        point = null,
        beside = null,
        gap = 4,
        align = 'start',
        prefer = 'bottom',
        fit = false,
    }
) {
    element.style.setProperty('--app-region', 'no-drag');
    const view = LAYER.viewportOf((anchor ?? beside ?? element).ownerDocument.defaultView);
    if (fit) element.style.maxHeight = '';
    const width = element.offsetWidth;
    let height = element.offsetHeight;
    let x;
    let y;
    let side;
    if (beside) {
        const row = beside.getBoundingClientRect();
        const menu = beside.parentElement.getBoundingClientRect();
        side = menu.right - OVERLAP + width > view.innerWidth - MARGIN ? 'left' : 'right';
        x = side === 'right' ? menu.right - OVERLAP : menu.left + OVERLAP - width;
        y = row.top - 4;
        if (fit) height = fitted(element, height, view.innerHeight - 2 * FIT.edge);
    } else if (fit) {
        const box = rect || anchor?.getBoundingClientRect() || { top: point.y, bottom: point.y };
        const start = anchor || rect ? gap : 0;
        const roomBelow = view.innerHeight - FIT.edge - (box.bottom + start);
        const roomAbove = box.top - start - FIT.edge;
        side = height <= roomBelow || roomBelow >= FIT.low || roomBelow >= roomAbove ? 'bottom' : 'top';
        height = fitted(element, height, side === 'bottom' ? roomBelow : roomAbove);
        x = point ? point.x : box.left;
        y = side === 'bottom' ? box.bottom + start : box.top - start - height;
    } else if (anchor || rect) {
        const box = rect || anchor.getBoundingClientRect();
        const below = box.bottom + gap;
        const above = box.top - gap - height;
        const fitsBelow = below + height <= view.innerHeight - MARGIN;
        const fitsAbove = above >= MARGIN;
        side =
            prefer === 'top'
                ? fitsAbove || !fitsBelow
                    ? 'top'
                    : 'bottom'
                : fitsBelow || !fitsAbove
                  ? 'bottom'
                  : 'top';
        x = align === 'center' ? (box.left + box.right) / 2 - width / 2 : box.left;
        y = side === 'bottom' ? below : above;
    } else {
        side = point.y + height > view.innerHeight - MARGIN ? 'top' : 'bottom';
        x = point.x;
        y = side === 'bottom' ? point.y : point.y - height;
    }
    const edge = fit ? FIT.edge : MARGIN;
    element.style.left = clamp(x, MARGIN, view.innerWidth - width - MARGIN) + 'px';
    element.style.top = clamp(y, edge, view.innerHeight - height - edge) + 'px';
    element.dataset.side = side;
    return side;
}

// MARK: - Private
// `element` no taller than `room` and FIT.tallest, answering its height then.
function fitted(element, height, room) {
    const most = Math.max(0, Math.min(room, FIT.tallest));
    element.style.maxHeight = most + 'px';
    return Math.min(height, most);
}

function clamp(value, low, high) {
    return Math.max(low, Math.min(value, high));
}

export { Z, place };
