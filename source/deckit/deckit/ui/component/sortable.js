DeckitModule.define(
    'deckit/ui/component/sortable',
    {
        uses: ['deckit/ui/token', 'deckit/ui/scroll', 'deckit/ui/gesture', 'deckit/ui/list'],
        provides: ['STYLE', 'make'],
    },
    (TOKEN, SCROLL, GESTURE, LIST) => {
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
        function sortable(theme, list, { onReorder }) {
            const { element } = list;
            return GESTURE.drag(element, {
                pick: (target) => {
                    for (let node = target; node && node !== element; node = node.parentElement)
                        if (node.parentElement === element) return node;
                    return null;
                },
                begin: LIST.heldWhile(element, (row, down, finished) =>
                    lift(
                        theme,
                        element,
                        row,
                        down.clientY,
                        (from, to) => from !== to && onReorder(list.keyOf(from), list.keyOf(to)),
                        finished
                    )
                ),
            });
        }

        // The row lifted, the others sliding aside as it passes them. The rows are the owner's items as laid out: one that
        // is not laid out has no place to move to or from, and one folding away is no longer an item.
        function lift(theme, list, row, startY, reorder, finished) {
            const MOTION = TOKEN.MOTION;
            const rows = [...list.children].filter(
                (child) => child.getClientRects().length && !child.hasAttribute(LIST.LEAVING)
            );
            const from = rows.indexOf(row);
            if (from < 0 || rows.length < 2) return null;
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
            const slide = `transform ${MOTION.base}ms ${MOTION.easing}`;
            rows.forEach((child, index) => index !== from && (child.style.transition = slide));
            // The fill is an inset shadow, not a background: the background is the hover's, which repaints as the
            // pointer comes and goes during the drag.
            if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
            Object.assign(row.style, {
                zIndex: '2',
                boxShadow: `inset 0 0 0 100vmax ${theme.color.lifted}, ${theme.shadow.lifted}`,
                transition: 'none',
            });
            const place = (offset, scale) => (row.style.transform = `translateY(${offset}px) scale(${scale})`);
            place(0, LIFTED);
            // Where the row goes is read from the pointer, not from the row held to the list: held, its middle could
            // never pass the end rows' middles, so no row could go first or last.
            const lowest = boxes[0].top;
            const highest = boxes.at(-1).bottom - held.height;
            let to = from;
            let timer = 0;
            let done = false;
            let then = null;
            const follow = (y) => {
                const top = held.top + y + scrolled() - startY;
                place(Math.min(highest, Math.max(lowest, top)) - held.top, LIFTED);
                const middle = top + held.height / 2;
                to = from;
                for (let index = from + 1; index < rows.length; index++)
                    if (middle > boxes[index].top + boxes[index].height / 2) to = index;
                for (let index = from - 1; index >= 0; index--)
                    if (middle < boxes[index].top + boxes[index].height / 2) to = index;
                rows.forEach((child, index) => {
                    if (index === from) return;
                    const shift = index > from && index <= to ? -span : index < from && index >= to ? span : 0;
                    child.style.transform = shift ? `translateY(${shift}px)` : '';
                });
            };
            // Everything as it was, all at once, so the next frame is the owner's order and nothing in between.
            const restore = () => {
                done = true;
                clearTimeout(timer);
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
                if (MOTION.base) timer = setTimeout(runThen, MOTION.base);
                else runThen();
            };
            return {
                follow: (_x, y) => follow(y),
                // The list is let go of whatever the owner's reorder does, or every later change would wait on it.
                drop: () => {
                    const target = to === from ? held.top : to > from ? boxes[to].bottom - held.height : boxes[to].top;
                    settle(target, () => {
                        restore();
                        try {
                            reorder(rows[from], rows[to]);
                        } finally {
                            finished();
                        }
                    });
                },
                cancel: () => {
                    rows.forEach((child, index) => index !== from && (child.style.transform = ''));
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

        return { STYLE, make };
    }
);
