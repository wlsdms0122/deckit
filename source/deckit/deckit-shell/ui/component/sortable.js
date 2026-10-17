import * as TOKEN from '../token/index.js';
import * as MOTION from '../motion/index.js';
import * as SCROLL from '../scroll/index.js';
import * as GESTURE from '../gesture/index.js';
import * as LIST from '../list/index.js';

// MARK: - Property
const STYLE = '';
// A lifted row grows by this much.
const LIFTED = 1.02;

// MARK: - Initializer
// MARK: - Public
function make(theme) {
    return { sortable: (list, options) => sortable(theme, list, options) };
}

// MARK: - Private
// The rows of a keyed list put in a new order by a drag. The list itself is not reordered: `onReorder(key, toKey)`
// hears that the item `key` goes where `toKey` is, and the owner draws the new order. Keys, so a change to the
// items while the drag holds the list does not move another one. Returns the dispose.
//
// With `depth`, the rows nest, and how far the pointer moves sideways asks for a depth as well: a level for
// each `depth.indent` px, to the nearest. `depth.project(key, toKey, levels)` answers the depth the row would
// take there, levels deeper (or shallower) than it is, and the held row stands that far in. `onReorder(key,
// toKey, depth)` then hears a move to the same place at another depth too. `depth.descendants(key)` are the keys
// of the rows that go with the row `key`: they are put away while it is held, and are not places it can go.
//
// With `movesInto(key, toKey)`, a row held over the middle of a row it answers true for goes into that row
// rather than beside it: the row lights, and `onMoveInto(key, toKey)` hears the drop.
function sortable(theme, list, { onReorder, depth = null, movesInto = null, onMoveInto = null }) {
    const { element } = list;
    return GESTURE.drag(element, {
        pick: (target) => {
            for (let node = target; node && node !== element; node = node.parentElement)
                if (node.parentElement === element) return node;
            return null;
        },
        begin: LIST.heldWhile(element, (row, down, finished) =>
            lift(theme, list, row, down, { onReorder, depth, movesInto, onMoveInto }, finished)
        ),
    });
}

// The row lifted, the others sliding aside as it passes them. The rows are the owner's items as laid out: one that
// is not laid out has no place to move to or from, and one folding away is no longer an item.
function lift(theme, keyed, row, down, { onReorder, depth, movesInto, onMoveInto }, finished) {
    const { base, easing } = TOKEN.MOTION;
    const { element: list, keyOf } = keyed;
    const key = keyOf(row);
    // Put away before anything is measured, so the places are the ones left without them.
    const carried = (depth?.descendants?.(key) || []).map((name) => keyed.elementOf(name)).filter(Boolean);
    const keptDisplay = carried.map((child) => child.style.display);
    const showCarried = () => carried.forEach((child, index) => (child.style.display = keptDisplay[index]));
    carried.forEach((child) => {
        MOTION.finish(child);
        child.style.display = 'none';
    });
    const rows = [...list.children].filter(
        (child) => child.getClientRects().length && !child.hasAttribute(LIST.LEAVING)
    );
    const from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) {
        showCarried();
        return null;
    }
    // A row still unfolding is taken at its own size.
    rows.forEach((child) => MOTION.finish(child));
    // Places are read once, as they stood at the lift; a scroll since is added to the pointer instead.
    const boxes = rows.map((child) => child.getBoundingClientRect());
    const held = boxes[from];
    const scroller = SCROLL.scrollerOf(list);
    const scrolledAt = scroller ? scroller.scrollTop : 0;
    const scrolled = () => (scroller ? scroller.scrollTop - scrolledAt : 0);
    // How far a row moves to take the held row's place: its height and the gap after it.
    const span = held.height + Math.max(0, boxes[1].top - boxes[0].bottom);
    const kept = rows.map((child) => ({
        transition: child.style.transition,
        transform: child.style.transform,
    }));
    const keptHeld = { position: row.style.position, zIndex: row.style.zIndex, boxShadow: row.style.boxShadow };
    const slide = `transform ${base}ms ${easing}`;
    rows.forEach((child, index) => index !== from && (child.style.transition = slide));
    // The fill is an inset shadow, not a background: the background is the hover's, which repaints as the
    // pointer comes and goes during the drag.
    if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
    Object.assign(row.style, {
        zIndex: '2',
        boxShadow: `inset 0 0 0 100vmax ${theme.color.lifted}, ${theme.shadow.lifted}`,
        transition: 'none',
    });
    const project = (to, levels) => (depth ? depth.project(key, keyOf(rows[to]), levels) : 0);
    const startDepth = project(from, 0);
    let projected = startDepth;
    const place = (offset, scale) => {
        const inward = (projected - startDepth) * (depth?.indent || 0);
        row.style.transform = `translate(${inward}px, ${offset}px) scale(${scale})`;
    };
    place(0, LIFTED);
    // Where the row goes is read from the pointer, not from the row held to the list: held, its middle could
    // never pass the end rows' middles, so no row could go first or last.
    const lowest = boxes[0].top;
    const highest = boxes.at(-1).bottom - held.height;
    let to = from;
    // The row it goes into, or -1. Over the middle half of a row that takes it, it is the row the held one stands
    // over, which stays where it is: the rows between slide aside as they would for a move beside it.
    let into = -1;
    let timer = 0;
    let done = false;
    let then = null;
    const intoAt = (middle) => {
        if (!movesInto) return -1;
        const index = boxes.findIndex(
            (box, at) => at !== from && middle > box.top + box.height / 4 && middle < box.bottom - box.height / 4
        );
        return index >= 0 && movesInto(key, keyOf(rows[index])) ? index : -1;
    };
    const light = (index) => {
        rows[into]?.removeAttribute('data-deckit-target');
        into = index;
        rows[into]?.setAttribute('data-deckit-target', '');
    };
    const follow = (x, y) => {
        const top = held.top + y + scrolled() - down.clientY;
        const middle = top + held.height / 2;
        light(intoAt(middle));
        to = from;
        if (into >= 0) to = into > from ? into - 1 : into + 1;
        else {
            for (let index = from + 1; index < rows.length; index++)
                if (middle > boxes[index].top + boxes[index].height / 2) to = index;
            for (let index = from - 1; index >= 0; index--)
                if (middle < boxes[index].top + boxes[index].height / 2) to = index;
        }
        if (depth) projected = into >= 0 ? startDepth : project(to, Math.round((x - down.clientX) / depth.indent));
        place(Math.min(highest, Math.max(lowest, top)) - held.top, LIFTED);
        rows.forEach((child, index) => {
            if (index === from) return;
            const shift = index > from && index <= to ? -span : index < from && index >= to ? span : 0;
            child.style.transform = shift ? `translateY(${shift}px)` : '';
        });
    };
    // On the row it goes into, or in its new place.
    const restingTop = () => {
        if (into >= 0) return boxes[into].top;
        if (to === from) return held.top;
        return to > from ? boxes[to].bottom - held.height : boxes[to].top;
    };
    // Everything as it was, all at once, so the next frame is the owner's order and nothing in between.
    const restore = () => {
        done = true;
        clearTimeout(timer);
        light(-1);
        showCarried();
        rows.forEach((child, index) => {
            child.style.transition = 'none';
            child.style.transform = kept[index].transform;
        });
        Object.assign(row.style, keptHeld);
        void list.offsetHeight;
        rows.forEach((child, index) => (child.style.transition = kept[index].transition));
    };
    const runThen = () => {
        const after = then;
        then = null;
        after?.();
    };
    const settle = (target, after) => {
        row.style.transition = slide;
        place(target - held.top, 1);
        then = after;
        if (base) timer = setTimeout(runThen, base);
        else runThen();
    };
    return {
        follow,
        // The list is let go of whatever the owner's reorder does, or every later change would wait on it.
        drop: () => {
            const intoKey = into >= 0 ? keyOf(rows[into]) : null;
            settle(restingTop(), () => {
                restore();
                try {
                    if (intoKey !== null) onMoveInto(key, intoKey);
                    else if (depth && (to !== from || projected !== startDepth))
                        onReorder(key, keyOf(rows[to]), projected);
                    else if (!depth && to !== from) onReorder(key, keyOf(rows[to]));
                } finally {
                    finished();
                }
            });
        },
        cancel: () => {
            rows.forEach((child, index) => index !== from && (child.style.transform = ''));
            light(-1);
            projected = startDepth;
            settle(held.top, () => {
                restore();
                finished();
            });
        },
        scroller: () => scroller,
        // A new press gets the list as it will be, without waiting for the settle.
        settleNow: () => {
            if (then) {
                clearTimeout(timer);
                runThen();
            } else if (!done) {
                restore();
                finished();
            }
        },
    };
}

export { STYLE, make };
