import * as LIST from '../../../deckit-sdk/shell/ui/list/index.js';
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DOCK from './model/dock.js';
import * as DECLARED from '../../../deckit-sdk/shell/dock/protocol.js';

// MARK: - Property
const { SLIVER, WIDTH, RADIUS } = DOCK;
// How long the Dock stays out once the pointer has left it.
const HIDE_DELAY = 400;
// An item: square, as wide as the card inside its padding, the icon 4px in from its edges; the running dot in the
// card's padding beside it, its centre `dot` px from the card's edge.
const ITEM = Object.freeze({ size: 48, inset: 4, dot: 4 });
// The card's padding around its items.
const CARD_PADDING = 8;
// How far right of the card, out, the name label and the menu stand.
const BESIDE = 8;
const STYLE = `
    .deckit-dock {
        position: fixed;
        left: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: ${WIDTH}px;
        box-sizing: border-box;
        padding: 8px 0;
        transform: translateX(-${WIDTH - SLIVER}px);
        transition: transform var(--deckit-move-fast) var(--deckit-easing-move);
    }
    .deckit-dock[data-out] { transform: none; transition-duration: var(--deckit-move-base); }
    @media (prefers-reduced-motion: reduce) {
        .deckit-dock[data-out] .deckit-dock-card { animation: deckit-dock-in var(--deckit-fade) var(--deckit-easing); }
    }
    @keyframes deckit-dock-in { from { opacity: 0; } }
    .deckit-dock-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 0 1 auto;
        gap: 4px;
        min-height: 0;
        box-sizing: border-box;
        padding: ${CARD_PADDING}px;
        overflow-y: auto;
        border-radius: 0 ${RADIUS}px ${RADIUS}px 0;
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
    }
    .deckit-dock-list { display: flex; flex-direction: column; gap: 4px; }
    .deckit-dock-divider { flex: 0 0 auto; width: 32px; margin: 4px 0; border-top: 1px solid var(--deckit-divider); }
    .deckit-dock-divider[hidden] { display: none; }
    .deckit-dock-item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${ITEM.size}px;
        height: ${ITEM.size}px;
        box-sizing: border-box;
        padding: ${ITEM.inset}px;
        border: 0;
        border-radius: var(--deckit-radius-card);
        background: transparent;
        cursor: pointer;
    }
    .deckit-dock-item[data-active] { background: var(--deckit-selected); }
    .deckit-dock-item:active .deckit-app-icon { filter: var(--deckit-shadow-icon) brightness(.85); }
    .deckit-dock-item[data-running]::after {
        content: '';
        position: absolute;
        top: calc(50% - 2px);
        left: ${ITEM.dot - 2 - CARD_PADDING}px;
        width: 4px;
        height: 4px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-muted);
    }
    .deckit-dock-item[data-attention]::after { background: var(--deckit-accent); }
    .deckit-dock-label {
        position: fixed;
        transform: translateY(-50%);
        padding: 4px 8px;
        border-radius: var(--deckit-radius-control);
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
        color: var(--deckit-text);
        font: var(--deckit-type-body);
        white-space: nowrap;
        pointer-events: none;
        animation: deckit-dock-label-in var(--deckit-fade) var(--deckit-easing);
    }
    @keyframes deckit-dock-label-in { from { opacity: 0; } }
`;

// MARK: - Initializer
// MARK: - Public
// The Dock, drawn in the desktop's page at the desktop's left edge, centred down it and as tall as its items: the items
// kept there, which a drag puts in another order, then those running only, each its mod's app icon. A running item has
// a dot at the card's edge beside its icon, in the accent where its mod asks for attention, and the active mod's item
// is marked; the item under the pointer has its name beside the card. It is in but for its sliver until the pointer
// comes, and stays out while the pointer is over it, a press holds it or its menu is open; it goes back in faster than
// it came out, and fades in where the system asks for reduced motion; `onOut(out)` hears it slide out and back. A click
// on an item opens its mod, and its menu, beside the item, shows it, quits it while it runs, and keeps it in the Dock
// or takes it out, each told to main over `channels`. `ui` is the page's kit.
function make({ ui, channels, onOut }) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    ui.addStyle(STYLE);
    let items = [];
    let active = null;
    let attention = new Set(); // the ids of the mods that ask for attention
    let out = false;
    let pointed = false; // whether the pointer is over the Dock
    let holds = 0; // the presses and menus that keep it out
    let hiding = null;
    let named = null; // the name label's layer while it shows

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
            const ids = kept.map((item) => item.id);
            const next = DOCK.dragged(ids, id, toId);
            if (next === ids) return;
            draw(
                next.map((one) => kept.find((item) => item.id === one)),
                items.filter(({ pinned }) => !pinned)
            );
            PROTOCOL.reorder.send({ ids: next });
        },
    });

    element.addEventListener('pointerenter', () => {
        pointed = true;
        settle();
    });
    element.addEventListener('pointerleave', () => {
        pointed = false;
        unname();
        settle();
    });
    element.addEventListener('pointerover', (event) => {
        const row = event.target.closest?.('.deckit-dock-item');
        if (row && !holds) name(row);
    });
    element.addEventListener('pointerdown', () => {
        unname();
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
        unname();
        const release = hold();
        row.setAttribute('data-deckit-target', '');
        ui.menu({
            items: menuOf(item),
            point: { x: WIDTH + BESIDE, y: row.getBoundingClientRect().top },
            onClose: () => {
                row.removeAttribute('data-deckit-target');
                release();
            },
        });
    });

    // `dock` `{ items, active, attention }`, as main tells it.
    function update(dock) {
        active = dock.active;
        attention = new Set(dock.attention);
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
        row.toggleAttribute('data-attention', attention.has(item.id));
        row.dataset.name = item.name;
        const states = [item.running && 'running', attention.has(item.id) && 'asks for attention'].filter(Boolean);
        row.setAttribute('aria-label', [item.name, ...states].join(', '));
        const drawn = JSON.stringify([item.icon, item.name]);
        if (row.dataset.drawn === drawn) return;
        row.dataset.drawn = drawn;
        row.replaceChildren(ui.appIcon(item.icon, { size: 'dock' }));
    }

    // The name of the item `row` beside the card, centred on it, at once: the Dock's one sign of the pointer over an
    // item, shown while the Dock is out and nothing holds it.
    function name(row) {
        if (!out) return;
        if (!named) {
            named = ui.layer(tag('div', 'deckit-dock-label'));
            named.element.setAttribute('aria-hidden', 'true');
        }
        const at = row.getBoundingClientRect();
        named.element.textContent = row.dataset.name;
        named.element.style.left = WIDTH + BESIDE + 'px';
        named.element.style.top = at.top + at.height / 2 + 'px';
    }

    function unname() {
        named?.remove();
        named = null;
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
        if (!on) unname();
        element.toggleAttribute('data-out', on);
        onOut(on);
    }

    return { element, update, setTop };
}

// MARK: - Private
function tag(name, className) {
    const made = document.createElement(name);
    made.className = className;
    return made;
}

export { make };
