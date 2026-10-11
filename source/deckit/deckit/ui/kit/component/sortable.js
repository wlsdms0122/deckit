DeckitModule.define("deckit/ui/kit/component/sortable", {
  uses: ["deckit/ui/token", "deckit/ui/kit/part"],
  provides: ["make"],
}, (TOKEN, K) => {
  const { MOTION } = TOKEN;

  return { make: (theme, ui, inner) => {
    return {
      sortable(list, onReorder) {
        // The rows on screen: a row that is not laid out has no place in the list to move to or from.
        const rows = () => [...list.children].filter((r) => r.getClientRects().length);
        const ms = (d) => parseFloat(d) || 0;
        K.press(list, {
          pick: (target) => {
            for (let n = target; n && n !== list; n = n.parentElement) if (n.parentElement === list) return n;
            return null;
          },
          begin: (row, down, finished) => lift(row, down.clientY, finished),
        });

        const lift = (row, startY, finished) => {
          const all = rows();
          const from = all.indexOf(row);
          if (from < 0 || all.length < 2) return null;
          /* Places are read once, as they stood when the row was lifted, and kept in those terms
             ("the list's coordinates at lift"); a scroll since is added to the pointer instead. */
          const boxes = all.map((r) => r.getBoundingClientRect());
          const held = boxes[from];
          const scroller = K.scrollerOf(list);
          const scrolledAt = scroller ? scroller.scrollTop : 0;
          const scrolled = () => (scroller ? scroller.scrollTop - scrolledAt : 0);
          // How far a row moves to take the held row's place: its height and the gap after it.
          const gap = Math.max(0, boxes[1].top - boxes[0].bottom);
          const span = held.height + gap;
          const kept = all.map((r) => ({ transition: r.style.transition, transform: r.style.transform }));
          const keptHeld = { position: row.style.position, zIndex: row.style.zIndex, boxShadow: row.style.boxShadow };
          const slide = `transform ${MOTION.base} ${MOTION.ease}`;
          all.forEach((r, i) => { if (i !== from) r.style.transition = slide; });

          /* The fill is an inset shadow, not a background: the background is the hover's to paint, and it
             repaints as the pointer comes and goes during the drag. */
          if (getComputedStyle(row).position === "static") row.style.position = "relative";
          Object.assign(row.style, {
            zIndex: "2",
            boxShadow: `inset 0 0 0 100vmax ${inner.HELD.fill}, ${inner.HELD.shadow}`,
            transition: "none",
          });
          const place = (dy, scale) => { row.style.transform = `translateY(${dy}px) scale(${scale})`; };
          place(0, 1.02);

          /* Where the row goes is read from the pointer, not from the row held to the list: held, its middle
             could never pass the end rows' middles, so no row could be put first or last. */
          const lowest = boxes[0].top, highest = boxes[boxes.length - 1].bottom - held.height;
          let to = from, settleTimer = 0, done = false;
          const follow = (y) => {
            const top = held.top + y + scrolled() - startY;
            place(Math.min(highest, Math.max(lowest, top)) - held.top, 1.02);
            const middle = top + held.height / 2;
            to = from;
            for (let i = from + 1; i < all.length; i++) if (middle > boxes[i].top + boxes[i].height / 2) to = i;
            for (let i = from - 1; i >= 0; i--) if (middle < boxes[i].top + boxes[i].height / 2) to = i;
            all.forEach((r, i) => {
              if (i === from) return;
              const shift = i > from && i <= to ? -span : i < from && i >= to ? span : 0;
              r.style.transform = shift ? `translateY(${shift}px)` : "";
            });
          };
          // Everything as it was, all at once, so the next frame is the caller's order and nothing in between.
          const restore = () => {
            done = true;
            clearTimeout(settleTimer);
            all.forEach((r, i) => { r.style.transition = "none"; r.style.transform = kept[i].transform; });
            Object.assign(row.style, keptHeld);
            void list.offsetHeight;
            all.forEach((r, i) => { r.style.transition = kept[i].transition; });
          };
          let then = null;
          const settle = (target, after) => {
            row.style.transition = slide;
            place(target - held.top, 1);
            then = after;
            const wait = ms(MOTION.base);
            if (wait) settleTimer = setTimeout(() => { const t = then; then = null; t?.(); }, wait); else { then = null; after(); }
          };
          const drop = () => {
            const target = to === from ? held.top : to > from ? boxes[to].bottom - held.height : boxes[to].top;
            /* The new order before the list is freed, so a redraw waiting on it (whenFree) draws that; freed
               whatever onReorder does, or every later redraw would wait. */
            settle(target, () => { restore(); try { if (to !== from) onReorder(from, to); } finally { finished(); } });
          };
          const cancel = () => {
            all.forEach((r, i) => { if (i !== from) r.style.transform = ""; });
            settle(held.top, () => { restore(); finished(); });
          };
          return {
            follow: (_x, y) => follow(y),
            drop,
            cancel,
            scroller: () => scroller,
            // A new press gets the list as it will be, without waiting for the settle.
            settleNow: () => {
              if (then) { clearTimeout(settleTimer); const t = then; then = null; t(); }
              else if (!done) { restore(); finished(); }
            },
          };
        };
        return list;
      },
    };
  } };
});
