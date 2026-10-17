import * as OVERLAY from '../overlay/index.js';
import * as GESTURE from '../gesture/index.js';
import * as LIST from '../list/index.js';

// MARK: - Property
const STYLE = `
    .deckit-marquee {
        position: fixed;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, var(--deckit-accent) 70%, transparent);
        background: color-mix(in srgb, var(--deckit-accent) 14%, transparent);
        pointer-events: none;
    }
`;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { marquee };
}

// MARK: - Private
// Selection by a rectangle dragged in `area`, as macOS Finder's: the rows it crosses are selected, with Shift or
// Command added to the rows of that list already selected, and a click on no row selects nothing. `listAt(element)`
// answers the keyed list a rectangle started there selects in, `{ list, ... }`, or null where none starts (where a
// press drags a row); `selection()` is the keys selected; `onSelect(keys, place)` hears the keys to select, in the
// list's order, with what `listAt` answered. Returns the dispose.
function marquee(area, { listAt, selection, onSelect }) {
    // On the click, not the press: a press on a scroll bar is never followed by one, and a click on a row is its
    // owner's. The click that ends a rectangle is the drag's.
    const onClick = (event) => {
        if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return;
        const place = listAt(event.target);
        if (place && !isInRow(event.target, place.list)) onSelect([], place);
    };
    const stop = GESTURE.drag(area, {
        pick: (target) => listAt(target) && target,
        begin: (target, down, finished) => draw(area, listAt(target), down, selection, onSelect, finished),
        cursor: 'default',
    });
    area.addEventListener('click', onClick);
    return () => {
        stop();
        area.removeEventListener('click', onClick);
    };
}

// The rows are read where they lie at the press; a scroll since is added to the pointer instead. The rectangle is
// drawn inside the box that scrolls the list, and scrolls it at its edges.
function draw(area, place, down, selection, onSelect, finished) {
    const { list } = place;
    const rows = [...list.element.children].filter(
        (child) => !child.hasAttribute(LIST.LEAVING) && list.keyOf(child) != null
    );
    const keys = rows.map(list.keyOf);
    const boxes = rows.map((row) => row.getBoundingClientRect());
    const adding = down.shiftKey || down.metaKey;
    const kept = new Set(adding ? selection().filter((key) => keys.includes(key)) : []);
    const scroller = scrollingBoxOf(list.element, area);
    const scrolledAt = scroller.scrollTop;
    const scrolled = () => scroller.scrollTop - scrolledAt;
    const clip = scroller.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'deckit-marquee';
    box.style.zIndex = String(OVERLAY.Z.drag);
    document.body.append(box);
    let selected = '';
    const follow = (x, y) => {
        const by = scrolled();
        const left = Math.min(down.clientX, x);
        const right = Math.max(down.clientX, x);
        const top = Math.min(down.clientY, y + by);
        const bottom = Math.max(down.clientY, y + by);
        const shown = {
            left: Math.max(clip.left, left),
            right: Math.min(clip.right, right),
            top: Math.max(clip.top, top - by),
            bottom: Math.min(clip.bottom, bottom - by),
        };
        Object.assign(box.style, {
            left: shown.left + 'px',
            top: shown.top + 'px',
            width: Math.max(0, shown.right - shown.left) + 'px',
            height: Math.max(0, shown.bottom - shown.top) + 'px',
        });
        const next = keys.filter(
            (key, index) =>
                kept.has(key) ||
                (boxes[index].left < right &&
                    boxes[index].right > left &&
                    boxes[index].top < bottom &&
                    boxes[index].bottom > top)
        );
        if (next.join('\n') === selected) return;
        selected = next.join('\n');
        onSelect(next, place);
    };
    const end = () => {
        box.remove();
        finished();
    };
    return { follow, drop: end, cancel: end, scroller: () => scroller };
}

// Whether `element` is in one of the rows of `list`.
function isInRow(element, list) {
    for (let node = element; node && node !== list.element; node = node.parentElement)
        if (node.parentElement === list.element) return list.keyOf(node) != null;
    return false;
}

// The box around `element` that scrolls it, whether or not it has more to show now; `area` when none does.
function scrollingBoxOf(element, area) {
    for (let node = element.parentElement; node && node !== area; node = node.parentElement)
        if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) return node;
    return area;
}

export { STYLE, make };
