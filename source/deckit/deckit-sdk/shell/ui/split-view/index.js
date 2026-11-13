import * as SCROLL from '../scroll/index.js';
import * as TOKEN from '../token/index.js';

// MARK: - Property
// The sidebar's width: a generous ceiling, as sidebar lists want width, and room left beside it for the content.
const MIN = 240;
const MAX = 720;
const CONTENT_MIN = 360;
// The card's inset from the window's edges and from the content. The divider's handle stands in the gap between them;
// folded, it stays at the window's edge, this far in. The card's corner is the window's (16) less this inset. Its list
// pads its sides by GUTTER, so the rows start under the window's buttons, as far in as they stand from the card's top.
const INSET = 8;
const GUTTER = 10;
const HANDLE = Object.freeze({ width: 16, height: 64, folded: 3 });
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
    }
    .deckit-split-card {
        position: absolute;
        top: ${INSET}px;
        bottom: ${INSET}px;
        left: ${INSET}px;
        width: var(--deckit-split-drawn);
        box-sizing: border-box;
        overflow: hidden;
        border-radius: var(--deckit-radius-medium);
        background: var(--deckit-sidebar);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-sidebar);
    }
    .deckit-split-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: max(0px, var(--deckit-safe-area-inset-top, 0px) - ${INSET}px) ${GUTTER}px 0;
    }
    .deckit-split-list > * { flex-shrink: 0; --deckit-safe-area-inset-top: 0px; }
    .deckit-split-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: max(0px, var(--deckit-safe-area-inset-top, 0px) - ${INSET}px);
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
        left: calc(var(--deckit-split-drawn) + ${1.5 * INSET - HANDLE.width / 2}px);
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
    }
    .deckit-split-handle::before {
        content: '';
        width: 4px;
        height: 36px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-muted);
        opacity: 0;
        transition: opacity var(--deckit-fade) var(--deckit-easing);
    }
    :is(.deckit-split-handle:hover, .deckit-split-handle:focus-visible, .deckit-split[data-dragging] .deckit-split-handle)::before {
        opacity: 1;
    }
    .deckit-split[data-collapsed] > .deckit-split-sidebar { width: 0; }
    .deckit-split[data-collapsed] > .deckit-split-handle { left: ${HANDLE.folded}px; cursor: pointer; }
`;

// MARK: - Initializer
// MARK: - Public
function make(_theme, ui) {
    return { splitView: (options) => splitView(ui, options) };
}

// MARK: - Private
// A sidebar beside the content, as a window's content or a part of it: `sidebar` in a card on the sidebar's material
// at the start, scrolling when it is taller than its card and holding what it lists from the safe area's top, the
// window's buttons over the card, and `content` in the rest, told its own title bar area: from its start while the
// sidebar is open, past the buttons while it is folded. The divider's handle
// sizes the sidebar by its drag, between MIN and MAX and leaving the content CONTENT_MIN, and folds or unfolds it by a
// click. `width` and `collapsed` are how it starts; `onChange({ width, collapsed })` hears each change the person
// makes, for the mod to keep. Answers `{ element, isCollapsed(), setCollapsed(collapsed), toggleSidebar(), width() }`.
function splitView(ui, { sidebar, content, width: given = MIN, collapsed: folded = false, onChange = null }) {
    let width = clamped(given);
    let collapsed = !!folded;
    let sliding = []; // the animations of a slide under way
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
        // A click of the pointer slides the sidebar; Enter or Space on the handle folds it at once.
        onClick: (event) => {
            fold(!collapsed, { slides: event.detail > 0 });
            onChange?.({ width, collapsed });
        },
        onDrag: (on) => element.toggleAttribute('data-dragging', on),
    });
    draw(width);

    function draw(px) {
        element.style.setProperty('--deckit-split-width', px + 'px');
        element.toggleAttribute('data-collapsed', collapsed);
        handle.setAttribute('aria-expanded', String(!collapsed));
        handle.title = collapsed ? 'Show Sidebar' : 'Hide Sidebar. Drag to resize.';
        // Folded, what it holds is out of the keyboard's reach too.
        column.inert = collapsed;
    }

    // With `slides`, the card slides out of the window or into it, and the content, its title bars with it, slides
    // beside it; the content keeps the wider of its two widths until it is still, so no gap opens at its far edge.
    // Without, as for what a key does, it changes at once.
    function fold(on, { slides = false } = {}) {
        const moving = [card, room, handle, ...room.querySelectorAll('.deckit-title-bar')];
        const before = new Map(moving.map((part) => [part, part.getBoundingClientRect().left]));
        settle();
        collapsed = !!on;
        draw(width);
        const length = TOKEN.MOTION.move.base;
        if (!slides || !length) return;
        const span = card.offsetWidth + 2 * INSET;
        if (!collapsed) room.style.marginRight = -span + 'px';
        column.style.overflow = 'visible';
        const shift = (part) => before.get(part) - part.getBoundingClientRect().left;
        const by = new Map(moving.map((part) => [part, shift(part)]));
        const timing = { duration: length, easing: TOKEN.MOTION.easingMove, fill: 'both' };
        const across = (from, to) => [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }];
        sliding = moving.map((part) => {
            if (part === card) return part.animate(across(by.get(card), collapsed ? -span : 0), timing);
            const own = by.get(part) - (part === room || part === handle ? 0 : by.get(room));
            return part.animate(across(own, 0), timing);
        });
        sliding[0].finished.then(settle, () => {});
    }

    // A slide under way stops where it is going.
    function settle() {
        for (const animation of sliding) animation.cancel();
        sliding = [];
        room.style.marginRight = '';
        column.style.overflow = '';
    }

    function setCollapsed(on) {
        fold(on);
    }

    function toggleSidebar() {
        fold(!collapsed);
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
