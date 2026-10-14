DeckitModule.define(
    'deckit-ui/ui/component/row',
    {
        uses: ['deckit-ui/ui/scroll', 'deckit-ui/ui/list'],
        provides: ['STYLE', 'make'],
    },
    (SCROLL, LIST) => {
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
            .deckit-row:hover { background: var(--deckit-hover); }
            .deckit-row[data-active] { background: var(--deckit-selected); }
            .deckit-row:hover [data-deckit-reveal],
            .deckit-row:focus-within [data-deckit-reveal],
            .deckit-row[data-revealed] [data-deckit-reveal] { opacity: 1; }
            .deckit-list { flex: 0 0 auto; }
            .deckit-list[data-scrolls] { overflow-y: auto; overscroll-behavior: contain; }
        `;
        const ROW_HEIGHT = Object.freeze({ medium: 28, small: 24 });

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { row, list };
        }

        // MARK: - Private
        // A row of a list, washed under the pointer. `setActive` marks it chosen; `setRevealed` keeps its actions shown.
        function row({ size = 'medium' } = {}) {
            const element = document.createElement('div');
            element.className = 'deckit-row';
            element.dataset.size = size;
            return {
                element,
                setActive: (on) => element.toggleAttribute('data-active', !!on),
                setRevealed: (on) => element.toggleAttribute('data-revealed', !!on),
            };
        }

        // The kit's keyed list (`key(item)`, `create(item)`, `update(element, item)`, `animated`). With `maxRows`, as tall as
        // that many rows, scrolling past them.
        function list({ maxRows = 0, size = 'medium', key, create, update = null, animated = false }) {
            const element = document.createElement('div');
            element.className = 'deckit-list';
            if (maxRows) {
                element.dataset.scrolls = '';
                element.style.maxHeight = maxRows * ROW_HEIGHT[size] + 'px';
                SCROLL.edgeFade(element);
            }
            return LIST.list({ element, key, create, update, animated });
        }

        return { STYLE, make };
    }
);
