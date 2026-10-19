import * as ICON from '../ui/icon/index.js';
import * as SCROLL from '../ui/scroll/index.js';
import * as KIT from '../ui/kit/index.js';
import * as LIST from '../ui/list/index.js';

// MARK: - Property
const NAV_MIN = 70;
const SLOT_MIN = 120;
const STYLE = `
    .deckit-sidebar-body {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
        padding: 5px 0 10px;
    }
    .deckit-sidebar-nav {
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
        min-height: ${NAV_MIN}px;
        overflow: hidden;
        box-sizing: border-box;
        padding: 0 12px;
    }
    .deckit-sidebar-nav .deckit-section { flex: 1 1 auto; min-height: 0; margin-top: 0; }
    .deckit-sidebar-nav .deckit-section-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0 -12px; padding: 0 12px; }
    .deckit-sidebar-slot { flex: 1 1 auto; min-height: 0; }
    .deckit-sidebar-splitter {
        position: relative;
        display: flex;
        align-items: center;
        flex: 0 0 auto;
        height: 9px;
        margin: 4px 12px 0;
        cursor: row-resize;
    }
    .deckit-sidebar-splitter::before {
        content: '';
        width: 100%;
        border-top: var(--deckit-border);
        opacity: 0.7;
        transition: opacity var(--deckit-base) var(--deckit-easing);
    }
    .deckit-sidebar-splitter:hover::before { opacity: 1; }
    .deckit-mod-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 28px;
        box-sizing: border-box;
        padding: 0 8px;
        border: 0;
        outline: none;
        border-radius: var(--deckit-radius-control);
        background: transparent;
        color: inherit;
        font: var(--deckit-type-large);
        text-align: left;
        cursor: pointer;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .deckit-mod-row:hover { background: var(--deckit-hover); }
    .deckit-mod-row[aria-selected='true'] { background: var(--deckit-selected); }
    .deckit-mod-row:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
    .deckit-mod-icon { display: flex; flex: 0 0 auto; }
`;

// MARK: - Initializer
// MARK: - Public
// What the panel's sidebar holds: the mods' list, and under it `slot`, where the mod on screen lays its own
// sidebar. What it draws is main's (`update(state)`), and what the person changes is told back: `onPick`,
// `onStep`, `onReorder`, `onLayout`. `onMove` hears the slot move as the list is sized.
function make({ ui, chordOf, onPick, onStep, onReorder, onLayout, onMove }) {
    KIT.addStyle(STYLE);
    let mods = [];
    let current = null;

    const body = element('div', 'deckit-sidebar-body');
    // The mods' list scrolls under its heading.
    const nav = element('div', 'deckit-sidebar-nav');
    const section = ui.section({
        label: 'Mods',
        title: true,
        actions: [
            { icon: ICON.icon('chevronLeft', { size: 16 }), title: 'Back', run: () => onStep(-1) },
            { icon: ICON.icon('chevronRight', { size: 16 }), title: 'Forward', run: () => onStep(1) },
        ],
    });
    ui.tooltip(section.actions[0].element, { text: 'Back', chord: () => chordOf('back') });
    ui.tooltip(section.actions[1].element, { text: 'Forward', chord: () => chordOf('forward') });
    nav.append(section.element);
    SCROLL.edgeFade(section.body);
    const rows = LIST.list({
        element: section.body,
        key: (mod) => mod.id,
        create: rowOf,
        update: (row, mod) => paintRow(row, mod),
    });
    // The new order is drawn here at once, and main, hearing it, has every view follow.
    ui.sortable(rows, {
        onReorder: (id, toId) => {
            const moved = mods.find((mod) => mod.id === id);
            const to = mods.findIndex((mod) => mod.id === toId);
            if (!moved || to < 0) return;
            const rest = mods.filter((mod) => mod !== moved);
            mods = [...rest.slice(0, to), moved, ...rest.slice(to)];
            rows.set(mods);
            onReorder(mods.map((mod) => mod.id));
        },
    });

    const splitter = element('div', 'deckit-sidebar-splitter');
    splitter.title = 'Drag to resize';
    ui.resizer(splitter, {
        axis: 'y',
        size: () => nav.getBoundingClientRect().height,
        min: NAV_MIN,
        max: () => {
            const style = getComputedStyle(body);
            const usable = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            const below = splitter.offsetHeight + parseFloat(getComputedStyle(splitter).marginTop) + SLOT_MIN;
            return Math.max(NAV_MIN, usable - below);
        },
        onResize: (px) => {
            nav.style.height = px + 'px';
            onMove();
        },
        onCommit: (px) => onLayout({ navHeight: Math.round(px) }),
    });

    const slot = element('div', 'deckit-sidebar-slot');
    body.append(nav, splitter, slot);
    // The list grows and shrinks with the mods in it, and the slot under it moves.
    new ResizeObserver(() => onMove()).observe(nav);

    function update(state) {
        mods = state.mods;
        current = state.current;
        rows.set(mods);
        section.actions[0].setEnabled(state.canBack);
        section.actions[1].setEnabled(state.canForward);
        if (state.frame.navHeight) nav.style.height = state.frame.navHeight + 'px';
    }

    function rowOf(mod) {
        const row = element('button', 'deckit-mod-row');
        row.type = 'button';
        row.dataset.modId = mod.id;
        row.setAttribute('role', 'tab');
        row.addEventListener('click', () => onPick(mod.id));
        paintRow(row, mod);
        return row;
    }

    function paintRow(row, mod) {
        row.setAttribute('aria-selected', String(mod.id === current));
        const drawn = JSON.stringify([mod.icon, mod.name]);
        if (row.dataset.drawn === drawn) return;
        row.dataset.drawn = drawn;
        const glyph = element('span', 'deckit-mod-icon');
        glyph.append(ICON.sanitize(mod.icon));
        const name = element('span', '');
        name.textContent = mod.name;
        row.replaceChildren(glyph, name);
    }

    // What the sidebar holds starts `top` px below its own top: under the window's title bar.
    function setTop(top) {
        body.style.paddingTop = top ? top + 'px' : '';
    }

    return { element: body, slot, update, setTop };
}

// MARK: - Private
function element(tag, className) {
    const made = document.createElement(tag);
    if (className) made.className = className;
    return made;
}

export { make };
