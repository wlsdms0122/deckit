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
        font: var(--deckit-type-body);
        white-space: nowrap;
        cursor: pointer;
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .deckit-row[data-size='small'] { gap: 6px; min-height: 24px; }
    .deckit-row:hover { background: var(--deckit-hover); }
    .deckit-row[data-active] { background: var(--deckit-selected); }
    /* A list with the keys (ui.tree) draws its chosen rows in the accent's tint, and is ringed only while none is. */
    [data-deckit-tree] { outline: none; }
    [data-deckit-tree]:focus-visible:not(:has(.deckit-row[data-active])) {
        outline: 2px solid var(--deckit-focus);
        outline-offset: -2px;
    }
    [data-deckit-tree]:focus-within .deckit-row[data-active] { background: var(--deckit-selected-focused); }
    .deckit-row-glyph { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
    .deckit-row[data-active] .deckit-row-glyph { color: inherit; }
    :is(.deckit-row, [data-deckit-row-actions]):not(
            :hover,
            :focus-within,
            [data-actions-shown],
            [data-deckit-row-actions='shown']
        )
        .deckit-row-action {
        position: absolute;
        width: 0;
        overflow: hidden;
        opacity: 0;
    }
    .deckit-list { flex: 0 0 auto; }
    .deckit-list[data-scrolls] { overflow-y: auto; overscroll-behavior: contain; }
`;
const ROW_HEIGHT = Object.freeze({ medium: 28, small: 24 });

// MARK: - Initializer
// MARK: - Public
function make() {
    return { row, list, tabs };
}

// MARK: - Private
// A row of a list, washed under the pointer. `glyph`, an svg or an element, leads it in its slot (`glyph`), in
// `muted`, and in the row's own ink while it is chosen; `setGlyph` shows another there. `setActive` marks it chosen,
// which it tells as selected, so the list that holds chosen rows is a `listbox`, a `tree` or `tabs`;
// `setActionsShown` keeps its actions shown. Its actions take no room while they are hidden, as in any element marked
// `data-deckit-row-actions`, which shows them as a row does, and keeps them shown while the mark is `shown`.
function row({ size = 'medium', glyph = null } = {}) {
    const element = document.createElement('div');
    element.className = 'deckit-row';
    element.dataset.size = size;
    const slot = glyph === null ? null : document.createElement('span');
    const setGlyph = (next) => {
        if (typeof next === 'string') slot.innerHTML = next;
        else slot.replaceChildren(...(next ? [next] : []));
    };
    if (slot) {
        slot.className = 'deckit-row-glyph';
        element.append(slot);
        setGlyph(glyph);
    }
    return {
        element,
        glyph: slot,
        setGlyph: slot ? setGlyph : () => {},
        setActive: (on) => {
            element.toggleAttribute('data-active', !!on);
            element.setAttribute('aria-selected', String(!!on));
        },
        setActionsShown: (on) => element.toggleAttribute('data-actions-shown', !!on),
    };
}

// The kit's keyed list (`key(item)`, `create(item)`, `update(element, item)`, `animated`). With `maxRows`, as tall as
// that many rows, scrolling past them. `role` is what it is to whoever reads the page, `list`, `listbox` where its
// rows are chosen, or `presentation` where what holds it is what its rows are items of, and `name` what it is called
// there.
function list({
    maxRows = 0,
    size = 'medium',
    role = 'list',
    name = '',
    key,
    create,
    update = null,
    animated = false,
}) {
    const element = document.createElement('div');
    element.className = 'deckit-list';
    element.setAttribute('role', role);
    if (name) element.setAttribute('aria-label', name);
    if (maxRows) {
        element.dataset.scrolls = '';
        element.style.maxHeight = maxRows * ROW_HEIGHT[size] + 'px';
        SCROLL.edgeFade(element);
    }
    return LIST.list({ element, key, create, update, animated });
}

// A keyed list of tabs, called `name`, each item a tab: `select(tab, on)` tells which one is chosen.
function tabs({ name = '', ...options }) {
    return {
        ...list({ ...options, role: 'tablist', name }),
        select: (tab, on) => tab.setAttribute('aria-selected', String(!!on)),
    };
}

export { STYLE, make };
