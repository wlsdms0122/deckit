import * as SCROLL from '../scroll/index.js';

// MARK: - Property
// The sidebar's width: a generous ceiling, as sidebar lists want width, and room left beside it for the content.
const MIN = 240;
const MAX = 720;
const CONTENT_MIN = 360;
// The card's inset from the window's edges and from the content, and how far the divider's handle stands past it,
// over the content's edge; folded, the handle stays at the window's edge, this far in.
const INSET = 8;
const HANDLE = Object.freeze({ width: 16, height: 64, out: 6, folded: 3 });
// The sidebar's material is drawn over the window's background material, which shows through the split view
// everywhere it draws nothing.
const STYLE = `
    .deckit-split {
        --deckit-split-drawn: min(var(--deckit-split-width), max(${MIN}px, 100cqw - ${CONTENT_MIN}px));
        position: relative;
        display: flex;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        container-type: inline-size;
    }
    .deckit-split-sidebar {
        position: relative;
        flex: 0 0 auto;
        width: calc(var(--deckit-split-drawn) + ${2 * INSET}px);
        overflow: hidden;
        transition: width var(--deckit-move-base) var(--deckit-easing-move);
    }
    .deckit-split-card {
        position: absolute;
        top: ${INSET}px;
        bottom: ${INSET}px;
        left: ${INSET}px;
        width: var(--deckit-split-drawn);
        box-sizing: border-box;
        overflow: hidden;
        border-radius: var(--deckit-radius-card);
        background: var(--deckit-sidebar);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-sidebar);
    }
    .deckit-split-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: max(0px, var(--deckit-title-bar-area-height, 0px) - ${INSET}px) 12px 0;
    }
    .deckit-split-list > * { flex-shrink: 0; }
    .deckit-split-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: max(0px, var(--deckit-title-bar-area-height, 0px) - ${INSET}px);
    }
    [data-deckit-title-bar] .deckit-split-bar { --app-region: drag; }
    .deckit-split-content {
        position: relative;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
    }
    .deckit-split:not([data-collapsed]) > .deckit-split-content { --deckit-title-bar-area-x: 0px; }
    .deckit-split-content > * { flex: 1 1 auto; min-height: 0; }
    .deckit-split-handle {
        position: absolute;
        top: calc(50% - ${HANDLE.height / 2}px);
        left: calc(var(--deckit-split-drawn) + ${2 * INSET + HANDLE.out - HANDLE.width / 2}px);
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${HANDLE.width}px;
        height: ${HANDLE.height}px;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: col-resize;
        --app-region: no-drag;
        transition: left var(--deckit-move-base) var(--deckit-easing-move);
    }
    .deckit-split-handle::before {
        content: '';
        width: 4px;
        height: 36px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-disabled);
        transition:
            background-color var(--deckit-fade) var(--deckit-easing),
            height var(--deckit-move-fast) var(--deckit-easing),
            width var(--deckit-move-fast) var(--deckit-easing);
    }
    .deckit-split-handle:hover::before,
    .deckit-split[data-dragging] .deckit-split-handle::before { width: 5px; height: 48px; background: var(--deckit-muted); }
    .deckit-split[data-collapsed] > .deckit-split-sidebar { width: 0; }
    .deckit-split[data-collapsed] > .deckit-split-handle { left: ${HANDLE.folded}px; cursor: pointer; }
    .deckit-split[data-dragging] > * { transition: none; }
`;

// MARK: - Initializer
// MARK: - Public
function make(_theme, ui) {
    return { splitView: (options) => splitView(ui, options) };
}

// MARK: - Private
// A sidebar beside the content, as a window's content or a part of it: `sidebar` in a card on the sidebar's material
// at the start, scrolling when it is taller than its card and holding what it lists from under the window's buttons,
// and `content` in the rest, its title bar clear of the buttons while the sidebar is folded. The divider's handle
// sizes the sidebar by its drag, between MIN and MAX and leaving the content CONTENT_MIN, and folds or unfolds it by a
// click. `width` and `collapsed` are how it starts; `onChange({ width, collapsed })` hears each change the person
// makes, for the mod to keep. Answers `{ element, isCollapsed(), setCollapsed(collapsed), toggleSidebar(), width() }`.
function splitView(ui, { sidebar, content, width: given = MIN, collapsed: folded = false, onChange = null }) {
    let width = clamped(given);
    let collapsed = !!folded;
    const element = tag('div', 'deckit-split');
    const column = tag('div', 'deckit-split-sidebar');
    const card = tag('div', 'deckit-split-card');
    const list = tag('div', 'deckit-split-list');
    const bar = tag('div', 'deckit-split-bar');
    const room = tag('div', 'deckit-split-content');
    const handle = tag('button', 'deckit-split-handle');
    handle.type = 'button';
    list.append(sidebar);
    card.append(list, bar);
    column.append(card);
    room.append(content);
    element.append(column, room, handle);
    SCROLL.edgeFade(list);
    ui.resizer(handle, {
        axis: 'x',
        size: () => card.getBoundingClientRect().width,
        min: MIN,
        max: () => Math.max(MIN, Math.min(MAX, element.clientWidth - CONTENT_MIN)),
        resizable: () => !collapsed,
        onResize: (px) => draw(px),
        onCommit: (px) => {
            width = clamped(px);
            draw(width);
            onChange?.({ width, collapsed });
        },
        onClick: () => {
            toggleSidebar();
            onChange?.({ width, collapsed });
        },
        onDrag: (on) => element.toggleAttribute('data-dragging', on),
    });
    draw(width);

    function draw(px) {
        element.style.setProperty('--deckit-split-width', px + 'px');
        element.toggleAttribute('data-collapsed', collapsed);
        handle.setAttribute('aria-expanded', String(!collapsed));
        handle.title = collapsed ? 'Show Sidebar' : 'Hide Sidebar · drag to resize';
        // Folded, what it holds is out of the keyboard's reach too.
        column.inert = collapsed;
    }

    function setCollapsed(on) {
        collapsed = !!on;
        draw(width);
    }

    function toggleSidebar() {
        setCollapsed(!collapsed);
    }

    return Object.freeze({
        element,
        isCollapsed: () => collapsed,
        setCollapsed,
        toggleSidebar,
        width: () => width,
    });
}

function clamped(width) {
    return Math.round(Math.min(MAX, Math.max(MIN, Number(width) || MIN)));
}

function tag(name, className) {
    const made = document.createElement(name);
    made.className = className;
    return made;
}

export { STYLE, make };
