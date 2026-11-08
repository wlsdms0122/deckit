import * as ICON from '../ui/icon/index.js';
import * as LIST from '../ui/list/index.js';
import * as CHANNEL from '../../deckit/channel/index.js';
import * as DOCK from './model/dock.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
const { SLIVER, WIDTH } = DOCK;
// How long the Dock stays out once the pointer has left it.
const HIDE_DELAY = 400;
const ITEM = 44;
const STYLE = `
    .deckit-dock {
        position: fixed;
        left: 0;
        bottom: 0;
        width: ${WIDTH}px;
        box-sizing: border-box;
        padding: 8px 0;
        transform: translateX(-${WIDTH - SLIVER}px);
        transition: transform var(--deckit-base) var(--deckit-easing);
    }
    .deckit-dock[data-out] { transform: none; }
    .deckit-dock-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        height: 100%;
        box-sizing: border-box;
        padding: 8px 0;
        overflow-y: auto;
        border: 1px solid var(--deckit-divider);
        border-left: 0;
        border-radius: 0 var(--deckit-radius-card) var(--deckit-radius-card) 0;
        background: var(--deckit-lifted);
        box-shadow: var(--deckit-shadow-drawer);
    }
    .deckit-dock-list { display: flex; flex-direction: column; gap: 4px; }
    .deckit-dock-divider { flex: 0 0 auto; width: 28px; margin: 2px 0; border-top: 1px solid var(--deckit-divider); }
    .deckit-dock-divider[hidden] { display: none; }
    .deckit-dock-item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${ITEM}px;
        height: ${ITEM}px;
        padding: 0;
        border: 0;
        outline: none;
        border-radius: var(--deckit-radius-large);
        background: transparent;
        color: var(--deckit-text);
        font: var(--deckit-type-heading);
        cursor: pointer;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .deckit-dock-item:hover { background: var(--deckit-hover); }
    .deckit-dock-item[data-active] { background: var(--deckit-selected); }
    .deckit-dock-item:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
    .deckit-dock-item svg { width: 24px; height: 24px; }
    .deckit-dock-item[data-running]::before {
        content: '';
        position: absolute;
        left: -1px;
        top: calc(50% - 2px);
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.6;
    }
`;

// MARK: - Initializer
// MARK: - Public
// The Dock, drawn in the desktop's page at the desktop's left edge: the items kept there, which a drag puts in another
// order, then those running only. A running item has a dot, and the active mod's item is marked. It is in but for its
// sliver until the pointer comes, and stays out while the pointer is over it, a press holds it or its menu is open;
// `onOut(out)` hears it slide out and back. A click on an item opens its mod, and its menu shows it, quits it while it
// runs, and keeps it in the Dock or takes it out, each told to main over `channels`. `ui` is the page's kit.
function make({ ui, channels, onOut }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    ui.addStyle(STYLE);
    let items = [];
    let active = null;
    let out = false;
    let pointed = false; // whether the pointer is over the Dock
    let holds = 0; // the presses and menus that keep it out
    let hiding = null;

    const element = tag('nav', 'deckit-dock');
    element.setAttribute('aria-label', 'Dock');
    const card = tag('div', 'deckit-dock-card');
    const keptList = LIST.list({
        element: tag('div', 'deckit-dock-list'),
        key: (item) => item.id,
        create: itemOf,
        update: paint,
    });
    const divider = tag('div', 'deckit-dock-divider');
    const runningList = LIST.list({
        element: tag('div', 'deckit-dock-list'),
        key: (item) => item.id,
        create: itemOf,
        update: paint,
    });
    card.append(keptList.element, divider, runningList.element);
    element.append(card);
    // The new order is drawn here at once, and main, hearing it, tells it back.
    ui.sortable(keptList, {
        onReorder: (id, toId) => {
            const kept = items.filter(({ pinned }) => pinned);
            const moved = kept.find((item) => item.id === id);
            const to = kept.findIndex((item) => item.id === toId);
            if (!moved || to < 0) return;
            const rest = kept.filter((item) => item !== moved);
            const next = [...rest.slice(0, to), moved, ...rest.slice(to)];
            draw(
                next,
                items.filter(({ pinned }) => !pinned)
            );
            PROTOCOL.reorder.send({ ids: next.map((item) => item.id) });
        },
    });

    element.addEventListener('pointerenter', () => {
        pointed = true;
        settle();
    });
    element.addEventListener('pointerleave', () => {
        pointed = false;
        settle();
    });
    element.addEventListener('pointerdown', () => {
        const release = hold();
        const up = () => {
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', up, true);
            release();
        };
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
    });
    element.addEventListener('contextmenu', (event) => {
        const row = event.target.closest?.('.deckit-dock-item');
        const item = row && items.find(({ id }) => id === row.dataset.modId);
        if (!item) return;
        event.preventDefault();
        const release = hold();
        row.setAttribute('data-deckit-target', '');
        ui.menu({
            items: menuOf(item),
            point: { x: event.clientX, y: event.clientY },
            onClose: () => {
                row.removeAttribute('data-deckit-target');
                release();
            },
        });
    });

    // `dock` `{ items, active }`, as main tells it.
    function update(dock) {
        active = dock.active;
        items = dock.items;
        draw(
            items.filter(({ pinned }) => pinned),
            items.filter(({ pinned }) => !pinned)
        );
    }

    // `top` px from the page's top, where the desktop starts.
    function setTop(top) {
        element.style.top = top + 'px';
    }

    // MARK: - Private
    function draw(kept, running) {
        keptList.set(kept);
        runningList.set(running);
        divider.hidden = !kept.length || !running.length;
    }

    function itemOf(item) {
        const row = tag('button', 'deckit-dock-item');
        row.type = 'button';
        row.dataset.modId = item.id;
        row.addEventListener('click', () => PROTOCOL.click.send({ id: item.id }));
        paint(row, item);
        return row;
    }

    function paint(row, item) {
        row.toggleAttribute('data-active', item.id === active);
        row.toggleAttribute('data-running', item.running);
        row.title = item.name;
        row.setAttribute('aria-label', item.running ? `${item.name}, running` : item.name);
        const drawn = JSON.stringify([item.icon, item.name]);
        if (row.dataset.drawn === drawn) return;
        row.dataset.drawn = drawn;
        row.replaceChildren(item.icon ? ICON.sanitize(item.icon) : initialOf(item.name));
    }

    function menuOf(item) {
        const opens = () => PROTOCOL.click.send({ id: item.id });
        return [
            { label: item.running ? 'Show' : 'Open', run: opens },
            ...(item.running ? [{ label: 'Quit', run: () => PROTOCOL.quit.send({ id: item.id }) }] : []),
            '-',
            item.pinned
                ? { label: 'Remove from Dock', run: () => PROTOCOL.keep.send({ id: item.id, pinned: false }) }
                : { label: 'Keep in Dock', run: () => PROTOCOL.keep.send({ id: item.id, pinned: true }) },
        ];
    }

    // Kept out until the returned release runs, once.
    function hold() {
        holds++;
        settle();
        return () => {
            holds--;
            settle();
        };
    }

    // Out at once as the pointer comes or something holds it; back in a moment after neither is so.
    function settle() {
        clearTimeout(hiding);
        if (pointed || holds > 0) return slide(true);
        hiding = setTimeout(() => slide(false), HIDE_DELAY);
    }

    function slide(on) {
        if (out === on) return;
        out = on;
        element.toggleAttribute('data-out', on);
        onOut(on);
    }

    return { element, update, setTop };
}

// MARK: - Private
// What a mod with no icon is drawn with: the first letter of its name.
function initialOf(name) {
    const initial = document.createElement('span');
    initial.textContent = [...String(name || '?')][0].toUpperCase();
    return initial;
}

function tag(name, className) {
    const made = document.createElement(name);
    made.className = className;
    return made;
}

export { make };
