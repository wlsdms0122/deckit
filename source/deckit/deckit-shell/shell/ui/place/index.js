// MARK: - Property
// What floats in the page over its own fixed things: a float (a toolbar, an autocomplete) and, above all of it, what a
// drag draws there.
const Z = Object.freeze({ float: 1150, drag: 2147483646 });
// How far inside the window a placed box stays.
const MARGIN = 8;
// How far a submenu overlaps the menu it opens from.
const OVERLAP = 6;

// MARK: - Initializer
// MARK: - Public
// Places a fixed box against a target, kept MARGIN inside the window, and returns the side it went to.
// - `anchor` (an element) or `rect`: below it, or above when only that fits. `align` is `start` or `center`.
// - `point`: at it, or above it.
// - `beside` (a row of a menu): right of the menu, overlapping it, or left of it when only that fits.
// `prefer` puts a box above its target first. A placed box takes presses where it lies, over a part of the
// page that drags the window too.
function place(
    element,
    { anchor = null, rect = null, point = null, beside = null, gap = 4, align = 'start', prefer = 'bottom' }
) {
    element.style.setProperty('--app-region', 'no-drag');
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    let x;
    let y;
    let side;
    if (beside) {
        const row = beside.getBoundingClientRect();
        const menu = beside.parentElement.getBoundingClientRect();
        side = menu.right - OVERLAP + width > window.innerWidth - MARGIN ? 'left' : 'right';
        x = side === 'right' ? menu.right - OVERLAP : menu.left + OVERLAP - width;
        y = row.top - 4;
    } else if (anchor || rect) {
        const box = rect || anchor.getBoundingClientRect();
        const below = box.bottom + gap;
        const above = box.top - gap - height;
        const fitsBelow = below + height <= window.innerHeight - MARGIN;
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
        side = point.y + height > window.innerHeight - MARGIN ? 'top' : 'bottom';
        x = point.x;
        y = side === 'bottom' ? point.y : point.y - height;
    }
    element.style.left = clamp(x, MARGIN, window.innerWidth - width - MARGIN) + 'px';
    element.style.top = clamp(y, MARGIN, window.innerHeight - height - MARGIN) + 'px';
    element.dataset.side = side;
    return side;
}

// MARK: - Private
function clamp(value, low, high) {
    return Math.max(low, Math.min(value, high));
}

export { Z, place };
