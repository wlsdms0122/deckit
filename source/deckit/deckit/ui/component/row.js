DeckitModule.define(
    'deckit/ui/component/row',
    {
        uses: ['deckit/ui/token', 'deckit/ui/component/part'],
        provides: ['make'],
    },
    (T, K) => {
        const { MOTION } = T;

        const FOLDER_TINT = '#5aa9e6';

        /* The browser tells a row drawn under a resting pointer that it is hovered only a frame later, so a
     list redrawn on each key blinked its wash. Rows are lit at once from where the pointer is, once
     the redraw is over; on the pointer's next move the browser's own hover decides again. */
        let fresh = null; // rows made since the last look: row -> light it
        const litUnder = () => {
            const made = fresh;
            fresh = null;
            const at = K.pointerAt();
            if (!at) return;
            const hit = document.elementFromPoint(at.x, at.y);
            if (!hit) return;
            for (const [row, under] of made) if (row.isConnected && row.contains(hit)) under();
        };

        const ROW_HEIGHT = Object.freeze({ plain: 28, dense: 24 });

        // list -> the turn of its newest drawInSteps, so an older one stops.
        const stepping = new WeakMap();

        return {
            make: (theme, ui, inner) => {
                const row = ({ dense = false } = {}) => {
                    const r = document.createElement('div');
                    Object.assign(r.style, {
                        display: 'flex',
                        alignItems: 'center',
                        gap: dense ? '6px' : '8px',
                        width: '100%',
                        minHeight: ROW_HEIGHT[dense ? 'dense' : 'plain'] + 'px',
                        padding: `0 ${K.ROW_SIDE}px`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        font: (dense ? '13px ' : '15px ') + theme.font,
                        whiteSpace: 'nowrap',
                        transition: `background-color ${MOTION.fast} ${MOTION.ease}`,
                    });
                    return r;
                };
                const folderIcon = (open = false, size = 15) =>
                    ui.icon(open ? 'folderOpen' : 'folder', size, { color: FOLDER_TINT });
                return {
                    row,
                    folderIcon,
                    treeRow({
                        depth = 0,
                        folder = false,
                        folds = folder,
                        open = false,
                        glyph = '',
                        name = '',
                        dense = false,
                    } = {}) {
                        const r = row({ dense });
                        const size = dense ? 14 : 16;
                        r.style.paddingLeft = 4 + depth * 14 + 'px';
                        const caret = document.createElement('span');
                        Object.assign(caret.style, {
                            display: 'flex',
                            flex: '0 0 12px',
                            justifyContent: 'center',
                            opacity: folds ? '.55' : '0',
                            transform: open ? 'rotate(90deg)' : 'none',
                            transition: `transform ${MOTION.fast} ${MOTION.ease}`,
                        });
                        caret.dataset.caret = '';
                        caret.innerHTML = ui.icon('chevronRight', 12);
                        const mark = document.createElement('span');
                        Object.assign(mark.style, { display: 'flex', flex: '0 0 auto' });
                        mark.innerHTML = folder ? folderIcon(open, size) : glyph;
                        const label = document.createElement('span');
                        Object.assign(label.style, {
                            flex: '1 1 auto',
                            minWidth: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        });
                        label.textContent = name;
                        label.dataset.name = '';
                        r.append(caret, mark, label);
                        return r;
                    },
                    list({ most = 0, dense = false } = {}) {
                        const l = document.createElement('div');
                        Object.assign(l.style, { flex: '0 0 auto' });
                        if (most) {
                            Object.assign(l.style, {
                                maxHeight: most * ROW_HEIGHT[dense ? 'dense' : 'plain'] + 'px',
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                            });
                            T.scrollFade(l);
                        }
                        return l;
                    },
                    hoverable(row, isActive = () => false, { shows = () => false } = {}) {
                        /* `over` is the browser's hover, `lit` the guess from litUnder until the browser answers; losing
           the pointer lets go of the guess only. */
                        let over = false,
                            lit = false;
                        const paint = () => {
                            const hovered = over || lit;
                            row.style.background = isActive() ? T.WASH.cursor : hovered ? T.WASH.hover : 'transparent';
                            const shown = hovered || row.matches(':focus-within') || shows();
                            row.querySelectorAll('[data-deckit-reveal]').forEach((b) => {
                                b.style.opacity = shown ? '1' : '0';
                            });
                        };
                        row.addEventListener('mouseenter', () => {
                            over = true;
                            paint();
                        });
                        row.addEventListener('mouseleave', () => {
                            over = false;
                            paint();
                        });
                        row.addEventListener('focusin', paint);
                        row.addEventListener('focusout', () => setTimeout(paint, 0));
                        paint();
                        if (!fresh) {
                            fresh = new Map();
                            queueMicrotask(litUnder);
                        }
                        fresh.set(row, () => {
                            if (over || lit) return;
                            lit = true;
                            // The way back first: a guess made is a guess let go of, whatever happens after it.
                            K.afterPointer((lost) => {
                                if (lost || !row.matches(':hover')) {
                                    lit = false;
                                    paint();
                                }
                            });
                            paint();
                            /* Lit as it stands, not faded in, or the wash would travel in from nothing on every redraw. Only
             transitions are finished: a spinner in the row animates for ever and cannot be. */
                            [row, ...row.querySelectorAll('[data-deckit-reveal]')]
                                .flatMap((el) => el.getAnimations())
                                .filter((a) => a instanceof CSSTransition)
                                .forEach((a) => a.finish());
                        });
                        row.repaint = paint;
                        return row;
                    },
                    leaveRow(row, then) {
                        const ms = parseFloat(MOTION.fast) || 0;
                        const list = row?.parentElement;
                        if (row && row.dataset.deckitLeaving) return; // already going; the first press owns it
                        // A folded section or a collapsed sidebar keeps its rows at no height: no exit to wait for.
                        const hidden = row && (!row.offsetParent || !row.getBoundingClientRect().height);
                        if (!row || !ms || hidden) {
                            then?.();
                            return;
                        }
                        row.dataset.deckitLeaving = '1';
                        const height = row.getBoundingClientRect().height;
                        /* T.play forces the style flush: a close from the keyboard touches nothing that would flush it,
           and the row would blink out. */
                        T.play(
                            row,
                            {
                                transition: 'none',
                                height: height + 'px',
                                minHeight: '0',
                                overflow: 'hidden',
                                pointerEvents: 'none',
                            },
                            {
                                transition: `height ${MOTION.fast} ${MOTION.ease}, opacity ${MOTION.fast} ${MOTION.ease}, margin ${MOTION.fast} ${MOTION.ease}`,
                                height: '0px',
                                opacity: '0',
                                marginTop: '0',
                                marginBottom: '0',
                            }
                        );
                        setTimeout(() => {
                            /* Cleared before the callback, which is usually the redraw: a list waiting on leaving rows must
             not see this one still leaving. */
                            delete row.dataset.deckitLeaving;
                            then?.();
                            if (list) K.freed(list);
                        }, ms);
                    },
                    /* Posted tasks rather than timers: the keys waiting are taken between steps, and a page out of
         sight, whose timers are held back, still fills the list. */
                    drawInSteps(list, items, draw, { first = 80, slice = 80 } = {}) {
                        const turn = (stepping.get(list) || 0) + 1;
                        stepping.set(list, turn);
                        const scroller = K.scrollerOf(list);
                        const kept = scroller ? scroller.scrollTop : 0;
                        list.textContent = '';
                        let at = 0;
                        const add = (count) => {
                            const part = document.createDocumentFragment();
                            for (const end = Math.min(items.length, at + count); at < end; at++)
                                part.appendChild(draw(items[at]));
                            list.appendChild(part);
                        };
                        const next = () => scheduler.postTask(step, { priority: 'user-visible' });
                        const step = () => {
                            if (stepping.get(list) !== turn) return;
                            add(slice);
                            if (at < items.length) next();
                        };
                        add(first);
                        if (kept) {
                            while (at < items.length && scroller.scrollHeight < kept + scroller.clientHeight)
                                add(first);
                            scroller.scrollTop = kept;
                        }
                        if (at < items.length) next();
                    },
                    whenFree(list, draw) {
                        if (K.busy(list)) K.waiting.set(list, draw);
                        else draw();
                    },
                };
            },
        };
    }
);
