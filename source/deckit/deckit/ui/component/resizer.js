DeckitModule.define(
    'deckit/ui/component/resizer',
    {
        uses: ['deckit/ui/token', 'deckit/ui/component/part'],
        provides: ['make'],
    },
    (T, K) => {
        const { MOTION } = T;

        return {
            make: (theme, ui, inner) => {
                return {
                    resizer(
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
                        const read = (v) => (typeof v === 'function' ? v() : v);
                        // How far past a limit the pointer has gone, as how far the edge goes: never more than REACH.
                        const REACH = 40;
                        const give = (over) => REACH * (1 - 1 / ((over * 0.35) / REACH + 1));
                        /* The gesture in progress (a drag, or the spring after it): a new press or a click settles it
           first, or the two would write the size in turns. */
                        let gesture = null;
                        const settleNow = () => gesture?.settleNow();
                        // A press that travelled is not a click, wherever it is let go.
                        let travelledLast = false;
                        handle.addEventListener('pointerdown', (down) => {
                            if (down.button !== 0) return;
                            down.preventDefault();
                            settleNow();
                            const at = (e) => (axis === 'x' ? e.clientX : e.clientY);
                            const start = at(down),
                                from = size();
                            const lo = read(min),
                                sizing = resizable();
                            let moving = false,
                                release = null,
                                shown = from;
                            travelledLast = false;
                            const onMove = (e) => {
                                const delta = (at(e) - start) * grow;
                                if (!moving) {
                                    if (Math.abs(delta) < K.SLOP) return;
                                    travelledLast = true;
                                    if (!sizing) return;
                                    moving = true;
                                    release = T.grabPointer(axis === 'x' ? 'col-resize' : 'row-resize');
                                    onDrag?.(true);
                                    gesture = { settleNow: () => {} };
                                }
                                const wanted = Math.max(0, from + delta);
                                const hi = read(max);
                                shown =
                                    wanted > hi
                                        ? hi + give(wanted - hi)
                                        : wanted >= lo
                                          ? wanted
                                          : lo - give(lo - wanted);
                                resize(shown);
                            };
                            const onUp = () => {
                                window.removeEventListener('pointermove', onMove, true);
                                window.removeEventListener('pointerup', onUp, true);
                                window.removeEventListener('pointercancel', onUp, true);
                                if (!moving) return; // a press that did not travel is the click's (below)
                                release();
                                onDrag?.(false);
                                const end = Math.min(read(max), Math.max(lo, shown));
                                gesture = springTo(shown, end, () => {
                                    gesture = null;
                                    commit?.(end);
                                });
                            };
                            window.addEventListener('pointermove', onMove, true);
                            window.addEventListener('pointerup', onUp, true);
                            window.addEventListener('pointercancel', onUp, true);
                        });
                        // Through resize, so it is drawn the way a drag is. A page not being drawn is put there at once.
                        const springTo = (now, target, then) => {
                            const length = parseFloat(MOTION.base) || 0;
                            if (now === target || !length || document.hidden) {
                                resize(target);
                                then();
                                return null;
                            }
                            const t0 = performance.now();
                            let frame = 0;
                            const step = (t) => {
                                const k = Math.min(1, (t - t0) / length);
                                resize(now + (target - now) * (1 - Math.pow(1 - k, 3)));
                                if (k < 1) frame = requestAnimationFrame(step);
                                else then();
                            };
                            frame = requestAnimationFrame(step);
                            return {
                                settleNow: () => {
                                    cancelAnimationFrame(frame);
                                    resize(target);
                                    then();
                                },
                            };
                        };
                        // The click event is also what Enter and Space on the handle make.
                        handle.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (travelledLast) {
                                travelledLast = false;
                                return;
                            }
                            settleNow();
                            onClick?.();
                        });
                        return handle;
                    },
                };
            },
        };
    }
);
