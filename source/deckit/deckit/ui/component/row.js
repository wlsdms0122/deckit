DeckitModule.define(
    'deckit/ui/component/row',
    {
        uses: ['deckit/ui/token', 'deckit/ui/motion', 'deckit/ui/scroll', 'deckit/ui/list'],
        provides: ['STYLE', 'make'],
    },
    (TOKEN, MOTION, SCROLL, LIST) => {
        // MARK: - Property
        const STYLE = `
            .deckit-row {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                min-height: 28px;
                box-sizing: border-box;
                padding: 0 8px;
                border-radius: var(--deckit-radius-control);
                font: var(--deckit-type-large);
                white-space: nowrap;
                cursor: pointer;
                transition: background-color var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-row[data-size='small'] { gap: 6px; min-height: 24px; font: var(--deckit-type-body); }
            .deckit-hover:hover { background: var(--deckit-hover); }
            .deckit-hover[data-active] { background: var(--deckit-selected); }
            .deckit-hover:hover [data-deckit-reveal],
            .deckit-hover:focus-within [data-deckit-reveal],
            .deckit-hover[data-revealed] [data-deckit-reveal] { opacity: 1; }
            .deckit-list { flex: 0 0 auto; }
            .deckit-list[data-scrolls] { overflow-y: auto; overscroll-behavior: contain; }
        `;
        const ROW_HEIGHT = Object.freeze({ medium: 28, small: 24 });
        const stepping = new WeakMap(); // list -> the turn of its newest drawInSteps, so an older one stops

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return {
                row,
                list,
                hoverable,
                leaveRow,
                drawInSteps,
                whenFree,
            };
        }

        // MARK: - Private
        // A row of a list, washed under the pointer. `setActive` marks it chosen; `setRevealed` keeps its actions shown.
        function row({ size = 'medium' } = {}) {
            const element = document.createElement('div');
            element.className = 'deckit-row';
            element.dataset.size = size;
            return { element, ...hoverable(element) };
        }

        // With `maxRows`, as tall as that many rows, scrolling past them.
        // Rows drawn by key: `key(item)`, `create(item)`, `update(element, item)` and `exit` as the kit's keyed list.
        function list({ maxRows = 0, size = 'medium', key = null, create, update = null, exit = false } = {}) {
            const element = document.createElement('div');
            element.className = 'deckit-list';
            if (maxRows) {
                element.dataset.scrolls = '';
                element.style.maxHeight = maxRows * ROW_HEIGHT[size] + 'px';
                SCROLL.edgeFade(element);
            }
            if (!key) return { element };
            return LIST.list({ element, key, create, update, exit });
        }

        // The pointer's wash is the stylesheet's; `setActive` marks the element chosen, `setRevealed` keeps its actions
        // shown.
        function hoverable(element) {
            element.classList.add('deckit-hover');
            return {
                setActive: (on) => element.toggleAttribute('data-active', !!on),
                setRevealed: (on) => element.toggleAttribute('data-revealed', !!on),
            };
        }

        // The row folds away before `then`, usually the redraw that drops it. A row with no height has nothing to fold.
        function leaveRow(made, then) {
            const length = TOKEN.MOTION.fast;
            const list = made?.parentElement;
            if (made?.dataset.deckitLeaving) return;
            if (!made || !length || !made.offsetParent || !made.getBoundingClientRect().height) {
                then?.();
                return;
            }
            made.dataset.deckitLeaving = '1';
            const height = made.getBoundingClientRect().height;
            MOTION.play(
                made,
                {
                    transition: 'none',
                    height: height + 'px',
                    minHeight: '0',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                },
                {
                    transition: ['height', 'opacity', 'margin']
                        .map((property) => `${property} ${length}ms ${TOKEN.MOTION.easing}`)
                        .join(', '),
                    height: '0px',
                    opacity: '0',
                    marginTop: '0',
                    marginBottom: '0',
                }
            );
            setTimeout(() => {
                // Cleared before `then`, which redraws: a list waiting on leaving rows must not see this one still leaving.
                delete made.dataset.deckitLeaving;
                then?.();
                if (list) LIST.freed(list);
            }, length);
        }

        // Fills `list` with what `draw` makes of each item, a slice at a time. Posted tasks, not timers: the keys
        // waiting are taken between slices, and a page out of sight, whose timers are held back, still fills.
        function drawInSteps(list, items, draw, { first = 80, slice = 80 } = {}) {
            const turn = (stepping.get(list) || 0) + 1;
            stepping.set(list, turn);
            const scroller = SCROLL.scrollerOf(list);
            const kept = scroller ? scroller.scrollTop : 0;
            list.replaceChildren();
            let at = 0;
            const add = (count) => {
                const part = document.createDocumentFragment();
                for (const end = Math.min(items.length, at + count); at < end; at++) part.append(draw(items[at]));
                list.append(part);
            };
            const step = () => {
                if (stepping.get(list) !== turn) return;
                add(slice);
                if (at < items.length) next();
            };
            const next = () => scheduler.postTask(step, { priority: 'user-visible' });
            add(first);
            if (kept) {
                while (at < items.length && scroller.scrollHeight < kept + scroller.clientHeight) add(first);
                scroller.scrollTop = kept;
            }
            if (at < items.length) next();
        }

        function whenFree(list, draw) {
            if (LIST.busy(list)) LIST.waiting.set(list, draw);
            else draw();
        }

        return { STYLE, make };
    }
);
