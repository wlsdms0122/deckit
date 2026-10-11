DeckitModule.define(
    'deckit/ui/component/part',
    {
        uses: ['deckit/ui/token'],
        provides: [
            'look',
            'waiting',
            'busy',
            'freed',
            'SLOP',
            'scrollerOf',
            'inSight',
            'press',
            'pointerAt',
            'afterPointer',
            'ROW_SIDE',
        ],
    },
    (T) => {
        /* A list is busy while a row of it is held (lifted, dragged, renamed) or leaving: a redraw asked
     for then (whenFree) waits until it is free, and only the last one asked for runs. */
        const waiting = new WeakMap(); // list -> the redraw it is waiting to run
        const busy = (el) =>
            !!(el.matches?.('[data-deckit-held]') || el.querySelector?.('[data-deckit-held], [data-deckit-leaving]'));
        const freed = (el) => {
            for (let n = el; n; n = n.parentElement) {
                const draw = waiting.get(n);
                if (draw && !busy(n)) {
                    waiting.delete(n);
                    draw();
                }
            }
        };

        const look = (theme) => ({
            QUIET: T.blend(theme.contentColor, theme.contentBg, 0.62),
            DISABLED: T.blend(theme.contentColor, theme.contentBg, 0.3),
            mix: (t) => T.blend(theme.contentColor, theme.contentBg, t),
            // Something lifted by a drag: a sorted row, or a drag's label.
            HELD: {
                fill: T.blend(theme.contentColor, theme.contentBg, 0.1),
                shadow: '0 8px 22px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.2)',
            },
        });

        // A pointer that has not travelled this far since the press is a click, not a drag.
        const SLOP = 4;

        const scrollerOf = (el) => {
            for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
                const o = getComputedStyle(n).overflowY;
                if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
            }
            return null;
        };

        const inSight = (el) => {
            if (!el.isConnected || !el.getClientRects().length) return false;
            const box = scrollerOf(el.parentElement)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
            const at = el.getBoundingClientRect();
            return at.top >= box.top && at.bottom <= box.bottom;
        };

        /* The pointer's last position, for a part that needs it without an event of its own (a row drawn
     under a resting pointer). Let go of when the page loses the pointer: a panel put away gets no
     mouseout. afterPointer(fn) runs fn once: fn(false) on the next move, fn(true) when it is lost. */
        let pointer = null;
        let waitingOnPointer = [];
        const settlePointer = (lost) => {
            const all = waitingOnPointer;
            waitingOnPointer = [];
            for (const fn of all) fn(lost);
        };
        const forgetPointer = () => {
            pointer = null;
            settlePointer(true);
        };
        window.addEventListener(
            'pointermove',
            (e) => {
                pointer = { x: e.clientX, y: e.clientY };
                settlePointer(false);
            },
            { capture: true, passive: true }
        );
        window.addEventListener(
            'mouseout',
            (e) => {
                if (!e.relatedTarget) forgetPointer();
            },
            { capture: true, passive: true }
        );
        window.addEventListener('blur', forgetPointer);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) forgetPointer();
        });
        const pointerAt = () => pointer;
        const afterPointer = (fn) => {
            waitingOnPointer.push(fn);
        };

        // The click that ends a drag is the drag's, not what is under it.
        const swallowClick = () => {
            const swallow = (e) => {
                e.stopPropagation();
                e.preventDefault();
            };
            window.addEventListener('click', swallow, true);
            setTimeout(() => window.removeEventListener('click', swallow, true), 0);
        };

        /* The gesture under every drag in the kit. pick(target) finds the thing under a press; after SLOP,
     begin(item, down, finished) returns the drag { follow(x, y), drop(x, y), cancel(), scroller?(x, y),
     settleNow?() } or null, and the drag calls finished() once it has played out. A gesture is in one
     phase at a time (pressed, held, settling, ended), and every handler reads only that. */
        const gestures = new WeakMap(); // area -> the gesture under way in it
        const EDGE = 28;
        const press = (area, { pick, begin }) => {
            area.addEventListener('dragstart', (e) => {
                if (pick(e.target)) e.preventDefault();
            });
            area.addEventListener('pointerdown', (down) => {
                if (down.button !== 0 || down.target.closest?.('input, textarea, [contenteditable]')) return;
                const item = pick(down.target);
                if (!item || !area.contains(item)) return;
                gestures.get(area)?.end();
                let phase = 'pressed',
                    drag = null,
                    x = down.clientX,
                    y = down.clientY;
                let release = null,
                    layer = null,
                    frame = 0;
                const pointer = (on) => {
                    const f = on ? 'addEventListener' : 'removeEventListener';
                    window[f]('pointermove', onMove, true);
                    window[f]('pointerup', onUp, true);
                    window[f]('pointercancel', onCancel, true);
                };
                const letGo = () => {
                    release?.();
                    release = null;
                    layer?.drop();
                    layer = null;
                    window.removeEventListener('keydown', onKey, true);
                    window.removeEventListener('wheel', onWheel, { capture: true });
                    cancelAnimationFrame(frame);
                };
                const finished = () => {
                    if (phase === 'ended') return;
                    const held = !!drag;
                    phase = 'ended';
                    letGo();
                    if (gestures.get(area) === gesture) gestures.delete(area);
                    if (held) {
                        delete area.dataset.deckitHeld;
                        freed(area);
                    }
                };
                const settle = (how) => {
                    phase = 'settling';
                    letGo();
                    how();
                };
                const callOff = () => {
                    if (phase === 'held') settle(() => drag.cancel());
                };
                const onMove = (e) => {
                    x = e.clientX;
                    y = e.clientY;
                    if (phase === 'pressed') {
                        if (Math.abs(y - down.clientY) < SLOP && Math.abs(x - down.clientX) < SLOP) return;
                        drag = begin(item, down, finished);
                        if (!drag) {
                            pointer(false);
                            return finished();
                        }
                        phase = 'held';
                        area.dataset.deckitHeld = '';
                        release = T.grabPointer('grabbing');
                        layer = T.raise({ close: callOff });
                        window.addEventListener('keydown', onKey, true);
                        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
                        frame = requestAnimationFrame(edge);
                    }
                    if (phase === 'held') drag.follow(x, y);
                };
                const onUp = (e) => {
                    pointer(false);
                    if (phase === 'pressed') return finished();
                    // Swallowed also when Escape put it back while the button was still down.
                    swallowClick();
                    if (phase === 'held') settle(() => drag.drop(e.clientX, e.clientY));
                };
                const onCancel = () => {
                    pointer(false);
                    if (phase === 'pressed') return finished();
                    swallowClick();
                    callOff();
                };
                // Main hands Escape over for a docked panel; only the top layer answers it.
                const onKey = (e) => {
                    if (e.key !== 'Escape' || !layer?.isTop()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    callOff();
                };
                const onWheel = (e) => {
                    const sc = phase === 'held' && drag.scroller?.(e.clientX, e.clientY);
                    if (!sc) return;
                    e.preventDefault();
                    sc.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
                    drag.follow(x, y);
                };
                const edge = () => {
                    frame = 0;
                    if (phase !== 'held') return;
                    const sc = drag.scroller?.(x, y);
                    if (sc) {
                        const r = sc.getBoundingClientRect();
                        const by =
                            y < r.top + EDGE
                                ? -(r.top + EDGE - y) / 3
                                : y > r.bottom - EDGE
                                  ? (y - (r.bottom - EDGE)) / 3
                                  : 0;
                        if (by) {
                            const before = sc.scrollTop;
                            sc.scrollTop = before + Math.max(-12, Math.min(12, by));
                            if (sc.scrollTop !== before) drag.follow(x, y);
                        }
                    }
                    frame = requestAnimationFrame(edge);
                };
                const gesture = {
                    // A new press settles this one now: a press whose pointerup was lost is the case this is for.
                    end: () => {
                        pointer(false);
                        if (phase === 'pressed') finished();
                        else if (phase === 'held') settle(() => (drag.settleNow ? drag.settleNow() : drag.cancel()));
                        else if (phase === 'settling') drag.settleNow?.();
                    },
                };
                gestures.set(area, gesture);
                pointer(true);
            });
            return area;
        };

        return {
            look,
            waiting,
            busy,
            freed,
            SLOP,
            scrollerOf,
            inSight,
            press,
            pointerAt,
            afterPointer,
            // A section heading lines its icon up with the rows' icons by this.
            ROW_SIDE: 8,
        };
    }
);
