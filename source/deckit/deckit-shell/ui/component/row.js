import * as SCROLL from '../scroll/index.js';
import * as LIST from '../list/index.js';

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
    .deckit-row:hover .deckit-row-action,
    .deckit-row:focus-within .deckit-row-action,
    .deckit-row[data-actions-shown] .deckit-row-action { opacity: 1; }
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
// A row of a list, washed under the pointer. `setActive` marks it chosen; `setActionsShown` keeps its actions
// shown.
function row({ size = 'medium' } = {}) {
    const element = document.createElement('div');
    element.className = 'deckit-row';
    element.dataset.size = size;
    return {
        element,
        setActive: (on) => element.toggleAttribute('data-active', !!on),
        setActionsShown: (on) => element.toggleAttribute('data-actions-shown', !!on),
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

export { STYLE, make };
