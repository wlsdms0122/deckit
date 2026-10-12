DeckitModule.define(
    'deckit/ui/component/row',
    {
        uses: ['deckit/ui/token', 'deckit/ui/icon', 'deckit/ui/motion', 'deckit/ui/scroll', 'deckit/ui/list'],
        provides: ['STYLE', 'make'],
    },
    (TOKEN, ICON, MOTION, SCROLL, LIST) => {
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
            .deckit-tree-caret {
                display: flex;
                flex: 0 0 12px;
                justify-content: center;
                opacity: 0;
                transition: transform var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-tree-row[data-folds] .deckit-tree-caret { opacity: 0.55; }
            .deckit-tree-row[aria-expanded='true'] .deckit-tree-caret { transform: rotate(90deg); }
            .deckit-tree-mark { display: flex; flex: 0 0 auto; }
            .deckit-tree-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
            .deckit-list { flex: 0 0 auto; }
            .deckit-list[data-scrolls] { overflow-y: auto; overscroll-behavior: contain; }
        `;
        const ROW_HEIGHT = Object.freeze({ plain: 28, dense: 24 });
        const DEPTH_INDENT = 14;
        const stepping = new WeakMap(); // list -> the turn of its newest drawInSteps, so an older one stops

        // MARK: - Initializer
        // MARK: - Public
        function make(theme) {
            const folderIcon = (open = false, size = 15) =>
                ICON.icon(open ? 'folderOpen' : 'folder', size, { color: theme.color.folder });
            return {
                row,
                folderIcon,
                treeRow: (options) => treeRow(folderIcon, options),
                list,
                hoverable,
                leaveRow,
                drawInSteps,
                whenFree,
            };
        }

        // MARK: - Private
        function row({ dense = false } = {}) {
            const made = document.createElement('div');
            made.className = 'deckit-row';
            if (dense) made.dataset.size = 'small';
            return made;
        }

        // A row of a tree: a caret when it folds, its mark, its name (marked `data-name`, what a rename types over).
        function treeRow(
            folderIcon,
            { depth = 0, folder = false, folds = folder, open = false, glyph = '', name = '', dense = false } = {}
        ) {
            const made = row({ dense });
            made.classList.add('deckit-tree-row');
            made.style.paddingLeft = 4 + depth * DEPTH_INDENT + 'px';
            made.toggleAttribute('data-folds', folds);
            if (folds) made.setAttribute('aria-expanded', String(open));
            const caret = document.createElement('span');
            caret.className = 'deckit-tree-caret';
            caret.dataset.caret = '';
            caret.innerHTML = ICON.icon('chevronRight', 12);
            const mark = document.createElement('span');
            mark.className = 'deckit-tree-mark';
            mark.innerHTML = folder ? folderIcon(open, dense ? 14 : 16) : glyph;
            const label = document.createElement('span');
            label.className = 'deckit-tree-name';
            label.dataset.name = '';
            label.textContent = name;
            made.append(caret, mark, label);
            return made;
        }

        // With `most`, as tall as that many rows, scrolling past them.
        function list({ most = 0, dense = false } = {}) {
            const made = document.createElement('div');
            made.className = 'deckit-list';
            if (most) {
                made.dataset.scrolls = '';
                made.style.maxHeight = most * ROW_HEIGHT[dense ? 'dense' : 'plain'] + 'px';
                SCROLL.edgeFade(made);
            }
            return made;
        }

        // The pointer's wash is the stylesheet's. `isActive()` marks the row chosen, `shows()` keeps its actions out;
        // both are read again by `repaint()`.
        function hoverable(made, isActive = () => false, { shows = () => false } = {}) {
            made.classList.add('deckit-hover');
            made.repaint = () => {
                made.toggleAttribute('data-active', !!isActive());
                made.toggleAttribute('data-revealed', !!shows());
            };
            made.repaint();
            return made;
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
