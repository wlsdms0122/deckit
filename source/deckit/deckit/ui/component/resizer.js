DeckitModule.define(
    'deckit/ui/component/resizer',
    { uses: ['deckit/ui/token', 'deckit/ui/pointer', 'deckit/ui/gesture'], provides: ['STYLE', 'make'] },
    (TOKEN, POINTER, GESTURE) => {
        // MARK: - Property
        const STYLE = '';
        // How far past a limit the pointer has gone, as how far the edge goes: never more than REACH.
        const REACH = 40;
        const RESISTANCE = 0.35;

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { resizer };
        }

        // MARK: - Private
        // A handle that sizes something by its drag along `axis`. `size()` reads the size, `resize(px)` draws one,
        // `commit(px)` keeps the one let go of. Past `min` or `max` (numbers or functions read at the press) the edge
        // gives and springs back. A press that does not travel is a click (`onClick`); `onDrag(on)` hears a drag start
        // and end; `resizable()` says whether a drag sizes at all. Returns the dispose.
        function resizer(
            handle,
            {
                axis = 'x',
                grow = 1,
                size,
                min = 0,
                max = Infinity,
                resize,
                commit,
                onClick = null,
                onDrag = null,
                resizable = () => true,
            }
        ) {
            const listening = new AbortController();
            // The gesture in progress, a drag or the spring after it: a new press or a click settles it first, or the
            // two would write the size in turns.
            let gesture = null;
            // A press that travelled is not a click, wherever it is let go.
            let travelled = false;
            const positionOf = (event) => (axis === 'x' ? event.clientX : event.clientY);
            const press = (down) => {
                if (down.button !== 0) return;
                down.preventDefault();
                gesture?.settleNow();
                const start = positionOf(down);
                const from = size();
                const low = valueOf(min);
                const sizing = resizable();
                let moving = false;
                let release = null;
                let shown = from;
                travelled = false;
                const move = (event) => {
                    const delta = (positionOf(event) - start) * grow;
                    if (!moving) {
                        if (Math.abs(delta) < GESTURE.SLOP) return;
                        travelled = true;
                        if (!sizing) return;
                        moving = true;
                        release = POINTER.capture(axis === 'x' ? 'col-resize' : 'row-resize');
                        onDrag?.(true);
                        gesture = { settleNow: () => {} };
                    }
                    const wanted = Math.max(0, from + delta);
                    const high = valueOf(max);
                    shown =
                        wanted > high ? high + give(wanted - high) : wanted >= low ? wanted : low - give(low - wanted);
                    resize(shown);
                };
                const up = () => {
                    window.removeEventListener('pointermove', move, true);
                    window.removeEventListener('pointerup', up, true);
                    window.removeEventListener('pointercancel', up, true);
                    if (!moving) return;
                    release();
                    onDrag?.(false);
                    const end = Math.min(valueOf(max), Math.max(low, shown));
                    gesture = springTo(resize, shown, end, () => {
                        gesture = null;
                        commit?.(end);
                    });
                };
                window.addEventListener('pointermove', move, true);
                window.addEventListener('pointerup', up, true);
                window.addEventListener('pointercancel', up, true);
            };
            // The click event is also what Enter and Space on the handle make.
            const click = (event) => {
                event.preventDefault();
                if (travelled) {
                    travelled = false;
                    return;
                }
                gesture?.settleNow();
                onClick?.();
            };
            handle.addEventListener('pointerdown', press, { signal: listening.signal });
            handle.addEventListener('click', click, { signal: listening.signal });
            return () => listening.abort();
        }

        // Through `resize`, so it is drawn the way a drag is. A page not being drawn is put there at once.
        function springTo(resize, from, to, then) {
            const length = TOKEN.MOTION.base;
            if (from === to || !length || document.hidden) {
                resize(to);
                then();
                return null;
            }
            const start = performance.now();
            let frame = 0;
            const step = (now) => {
                const progress = Math.min(1, (now - start) / length);
                resize(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
                if (progress < 1) frame = requestAnimationFrame(step);
                else then();
            };
            frame = requestAnimationFrame(step);
            return {
                settleNow: () => {
                    cancelAnimationFrame(frame);
                    resize(to);
                    then();
                },
            };
        }

        function give(over) {
            return REACH * (1 - 1 / ((over * RESISTANCE) / REACH + 1));
        }

        function valueOf(given) {
            return typeof given === 'function' ? given() : given;
        }

        return { STYLE, make };
    }
);
