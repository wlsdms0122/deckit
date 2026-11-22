import * as LIST from '../../../deckit-sdk/shell/ui/list/index.js';
import * as TOKEN from '../../../deckit-sdk/shell/ui/token/index.js';
import * as MOTION from '../../../deckit-sdk/shell/ui/motion/index.js';
import * as DOCK from './model/dock.js';

// MARK: - Property
const { SLIVER, WIDTH, RADIUS, CARD } = DOCK;
// How long the Dock stays out once the pointer has left it.
const HIDE_DELAY = 400;
// An item: square, as wide as the card inside its padding, the icon 4px in from its edges; the running dot in the
// card's padding beside it, its centre `dot` px from the card's edge, `running` across, or `asking` where its mod asks
// for attention.
const ITEM = Object.freeze({ size: CARD.item, inset: 4, dot: 4 });
const DOT = Object.freeze({ running: 4, asking: 6 });
// The card's padding around its items.
const CARD_PADDING = CARD.padding;
// How far right of the card, out, the name label stands.
const BESIDE = DOCK.MENU.beside;
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
        transition: transform var(--deckit-exit) var(--deckit-exit-curve);
    }
    .deckit-dock[data-out] { transform: none; transition: transform var(--deckit-enter) var(--deckit-enter-curve); }
    @media (prefers-reduced-motion: reduce) {
        .deckit-dock[data-out] .deckit-dock-card {
            animation: deckit-dock-in var(--deckit-enter-fade) var(--deckit-enter-curve);
        }
    }
    @keyframes deckit-dock-in { from { opacity: 0; } }
    .deckit-dock-card[data-material] {
        background-color: color-mix(in srgb, var(--deckit-elevated) var(--deckit-glass), transparent);
    }
    .deckit-dock-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 0 1 auto;
        gap: ${CARD.gap}px;
        min-height: 0;
        box-sizing: border-box;
        padding: ${CARD_PADDING}px;
        overflow-y: auto;
        border-radius: 0 ${RADIUS}px ${RADIUS}px 0;
        background-color: var(--deckit-elevated);
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
    }
    .deckit-dock-list { display: flex; flex-direction: column; gap: ${CARD.gap}px; }
    .deckit-dock-divider { flex: 0 0 auto; width: 32px; margin: ${CARD.gap}px 0; border-top: 1px solid var(--deckit-divider); }
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
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .deckit-dock-item[data-active] { background: var(--deckit-selected); }
    .deckit-dock-item[data-held] {
        z-index: 1;
        scale: 1.02;
        box-shadow: inset 0 0 0 100vmax var(--deckit-lifted), var(--deckit-shadow-lifted);
    }
    .deckit-dock-item:active .deckit-app-icon { filter: var(--deckit-shadow-icon) brightness(.85); }
    .deckit-dock-item[data-running]::after {
        content: '';
        position: absolute;
        top: calc(50% - ${DOT.running / 2}px);
        left: ${ITEM.dot - DOT.running / 2 - CARD_PADDING}px;
        width: ${DOT.running}px;
        height: ${DOT.running}px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-muted);
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .deckit-dock-item[data-attention]::after {
        top: calc(50% - ${DOT.asking / 2}px);
        left: ${ITEM.dot - DOT.asking / 2 - CARD_PADDING}px;
        width: ${DOT.asking}px;
        height: ${DOT.asking}px;
        background: var(--deckit-accent);
    }
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
        animation: deckit-dock-label-in var(--deckit-press-fade) var(--deckit-press-curve);
    }
    @keyframes deckit-dock-label-in { from { opacity: 0; } }
    .deckit-dock-menu {
        position: fixed;
        box-sizing: border-box;
        background: var(--deckit-elevated);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
        color: var(--deckit-text);
        font: var(--deckit-type-body);
        animation: deckit-dock-label-in var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .deckit-dock-menu[hidden] { display: none; }
    .deckit-dock-menu[data-material] {
        background-color: color-mix(in srgb, var(--deckit-elevated) var(--deckit-glass), transparent);
    }
    .deckit-dock-menu-entry {
        position: absolute;
        box-sizing: border-box;
        padding: 0 12px 0 8px;
        border: 0;
        border-radius: var(--deckit-radius-control);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        white-space: nowrap;
        overflow: hidden;
        cursor: pointer;
    }
    .deckit-dock-menu-entry:hover, .deckit-dock-menu-entry:focus-visible {
        outline: 0;
        background: var(--deckit-selected);
    }
    .deckit-dock-menu-rule { position: absolute; }
    .deckit-dock-menu-rule::after {
        content: '';
        position: absolute;
        inset: 4px 6px;
        background: var(--deckit-divider);
    }
`;

// MARK: - Initializer
// MARK: - Public
// The Dock, drawn in the desktop's page at the desktop's left edge, centred down it and as tall as its items: the items
// kept there, then those running only, each its mod's app icon, in the order main tells, the one a seat drags lifted. A
// running item has a dot at the card's edge beside its icon, larger and in the accent where its mod asks for attention,
// and the active mod's item is marked; the item under the pointer has its name beside the card. It is in but for its
// sliver until the pointer comes, and stays out while the pointer is over it, a press holds it or its menu is open; it
// goes back in faster than it came out, and fades in where the system asks for reduced motion; `onOut(out)` hears it
// slide out and back. Out and still, the card is glass, its colour a tint over a material laid under it, where the
// system does not ask for less transparency, and so is the menu: `onGlass(materials)` hears `[{ material, x, y, width,
// height, cornerRadius }]`, the card's rounded at every corner and reaching past the desktop's left edge by its radius
// so its square corners stay so, none as it slides. The page recognizes nothing: `onPointer(event)` hears what the
// pointer does on the Dock and on the menu, `{ part: 'dock', type, x, y, button, count }` in the page, on the card as
// the Dock out has it, a context press as a press of button 2, and what the keyboard presses with `item`
// (desktop/protocol.js pointer); the menu of an item is drawn where main tells it, beside what slides, its entries at
// the rects the Dock's model gave them. `ui` is the page's kit.
function make({ ui, onPointer, onOut, onGlass }) {
    ui.addStyle(STYLE);
    let items = [];
    let active = null;
    let attention = new Set(); // the ids of the mods that ask for attention
    let held = null; // the id of the item a seat drags
    let menu = null; // the menu open, as main tells it
    let menuHeld = null; // what releases the Dock once the menu closes
    let out = false;
    let pointed = false; // whether the pointer is over the Dock
    let holds = 0; // the presses and menus that keep it out
    let hiding = null;
    let named = null; // the name label's layer while it shows
    let slides = 0; // the slides begun, so one that ends late is told apart
    let still = false; // whether it is out and done sliding

    const element = tag('nav', 'deckit-dock');
    element.setAttribute('aria-label', 'Dock');
    const card = tag('div', 'deckit-dock-card');
    card.dataset.deckitGlass = ''; // its material is the desktop's to lay
    const keptList = LIST.list({
        element: tag('div', 'deckit-dock-list'),
        key: (item) => item.id,
        create: itemOf,
        update: paint,
        animated: true,
    });
    const divider = tag('div', 'deckit-dock-divider');
    const runningList = LIST.list({
        element: tag('div', 'deckit-dock-list'),
        key: (item) => item.id,
        create: itemOf,
        update: paint,
        animated: true,
    });
    const menuBox = tag('div', 'deckit-dock-menu');
    menuBox.setAttribute('role', 'menu');
    menuBox.dataset.deckitGlass = '';
    menuBox.hidden = true;
    TOKEN.whenOpaque(glaze);
    card.append(keptList.element, divider, runningList.element);
    element.append(card);
    // The menu stands beside what slides, not in it: what moves is what its fixed descendants are placed against, so
    // a menu in it would stand off the model's rects until the slide is over.
    const root = tag('div', 'deckit-dock-root');
    root.append(element, menuBox);

    forward(card, true);
    forward(menuBox, false);
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
    // What the keyboard does in the menu: the arrows go from entry to entry, and Escape puts it away.
    menuBox.addEventListener('keydown', (event) => {
        const entries = [...menuBox.querySelectorAll('.deckit-dock-menu-entry')];
        const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
        if (step) entries.at((entries.indexOf(document.activeElement) + step) % entries.length)?.focus();
        else if (event.key === 'Escape') pressed('dock', '');
        else return;
        event.preventDefault();
    });

    // `dock` `{ items, active, attention, held, menu }`, as main tells it.
    function update(dock) {
        active = dock.active;
        attention = new Set(dock.attention);
        held = dock.held;
        items = dock.items;
        draw(
            items.filter(({ pinned }) => pinned),
            items.filter(({ pinned }) => !pinned)
        );
        drawMenu(dock.menu);
        glaze();
    }

    // `top` px from the page's top, where the desktop starts.
    function setTop(top) {
        element.style.top = top + 'px';
        glaze();
    }

    // MARK: - Private
    // What the pointer does on `node`, told as it does it: its first button's press there, and with the button held
    // each move and the up, wherever it goes; and a context press, however it is made. The document does nothing of
    // its own with a press. A context press the keyboard makes is on the item that has the focus. A point on what
    // `slides` is told where it is on the Dock out, as the model lays it, however far the Dock has slid.
    function forward(node, slides) {
        const send = (type, { clientX, clientY: y }, more) => {
            const x = clientX - (slides ? element.getBoundingClientRect().x : 0);
            onPointer({ part: 'dock', type, x, y, ...more });
        };
        const holding = (event) => node.hasPointerCapture(event.pointerId);
        node.addEventListener('pointerdown', (down) => {
            down.preventDefault();
            if (down.button !== 0) return;
            node.setPointerCapture(down.pointerId);
            send('down', down, { button: 0, count: down.detail });
        });
        node.addEventListener('pointermove', (event) => holding(event) && send('move', event, { button: 0 }));
        for (const ends of ['pointerup', 'pointercancel'])
            node.addEventListener(ends, (event) => holding(event) && send('up', event, { button: 0 }));
        node.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            unname();
            const focused = event.target.closest?.('.deckit-dock-item:focus-visible');
            if (focused) return pressed('dock', focused.dataset.modId, 2);
            for (const type of ['down', 'up']) send(type, event, { button: 2 });
        });
    }

    // What the keyboard presses is pressed and let go where it is: the item `item` of the Dock, an entry of the menu
    // with `part` 'dock-menu', or '' to put the menu away.
    function pressed(part, item, button = 0) {
        for (const type of ['down', 'up']) onPointer({ part, item, type, x: 0, y: 0, button });
    }

    // The menu `next` drawn where main tells it, each entry and each rule at its rect, the item it is of marked; the
    // Dock stays out while it is open. Opened from an item that has the focus, its first entry takes the focus, and
    // closed with the focus in it, the item takes it back.
    function drawMenu(next) {
        if (JSON.stringify(next) === JSON.stringify(menu)) return;
        const from = document.activeElement?.closest?.('.deckit-dock-item, .deckit-dock-menu') ?? null;
        for (const row of card.querySelectorAll('[data-deckit-target]')) row.removeAttribute('data-deckit-target');
        menu = next;
        menuBox.hidden = !menu;
        if (!menu) {
            menuBox.replaceChildren();
            menuHeld?.();
            menuHeld = null;
            return;
        }
        menuHeld ??= hold();
        const of = card.querySelector(`.deckit-dock-item[data-mod-id="${CSS.escape(menu.item)}"]`);
        of?.setAttribute('data-deckit-target', '');
        place(menuBox, menu.frame);
        menuBox.style.borderRadius = menu.radius + 'px';
        const inside = ({ x, y, width, height }) => ({ x: x - menu.frame.x, y: y - menu.frame.y, width, height });
        const entries = menu.entries.map(({ id, label, rect }) => {
            const entry = tag('button', 'deckit-dock-menu-entry');
            entry.type = 'button';
            entry.setAttribute('role', 'menuitem');
            entry.dataset.entry = id;
            entry.textContent = label;
            entry.addEventListener('click', ({ detail }) => detail === 0 && pressed('dock-menu', id));
            return place(entry, inside(rect));
        });
        menuBox.replaceChildren(
            ...entries,
            ...menu.rules.map((rect) => place(tag('div', 'deckit-dock-menu-rule'), inside(rect)))
        );
        if (from) entries[0]?.focus();
    }

    // An item that joins fades in and those that stay glide to where they are drawn; one that leaves goes at once.
    function draw(kept, running) {
        MOTION.glide([...card.querySelectorAll('.deckit-dock-item, .deckit-dock-divider')], () => {
            keptList.set(kept);
            runningList.set(running);
            divider.hidden = !kept.length || !running.length;
        });
    }

    function itemOf(item) {
        const row = tag('button', 'deckit-dock-item');
        row.type = 'button';
        row.dataset.modId = item.id;
        // An item the keyboard clicks is pressed and let go where it is.
        row.addEventListener('click', ({ detail }) => detail === 0 && pressed('dock', item.id));
        paint(row, item);
        return row;
    }

    function paint(row, item) {
        row.toggleAttribute('data-active', item.id === active);
        row.toggleAttribute('data-held', item.id === held);
        row.toggleAttribute('data-running', item.running);
        if (attention.has(item.id) && !row.hasAttribute('data-attention') && row.isConnected) ask(row);
        row.toggleAttribute('data-attention', attention.has(item.id));
        row.dataset.name = item.name;
        const states = [item.running && 'running', attention.has(item.id) && 'asks for attention'].filter(Boolean);
        row.setAttribute('aria-label', [item.name, ...states].join(', '));
        const drawn = JSON.stringify([item.icon, item.name]);
        if (row.dataset.drawn === drawn) return;
        row.dataset.drawn = drawn;
        row.replaceChildren(ui.appIcon(item.icon, { size: 'dock' }));
    }

    // An item that asks for attention lights once in the selection's tint, its dot easing to the accent: no bounce.
    function ask(row) {
        const style = getComputedStyle(row);
        const lit = style.getPropertyValue('--deckit-selected').trim();
        if (lit) MOTION.swell(row, { backgroundColor: style.backgroundColor }, { backgroundColor: lit });
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
        still = false;
        glaze();
        const slide = ++slides;
        if (on) moved(() => slide === slides && ((still = true), glaze()));
    }

    // Once what moves it, out or fading in, is over.
    function moved(then) {
        const running = element.getAnimations({ subtree: true }).filter(isMove);
        Promise.all(running.map(({ finished }) => finished.catch(() => {}))).then(then);
    }

    // The card as glass while it is still, opaque otherwise, the menu as glass with it, and main told where.
    function glaze() {
        const glass = still && !TOKEN.opaque();
        card.toggleAttribute('data-material', glass);
        menuBox.toggleAttribute('data-material', glass && !!menu);
        if (!glass) return onGlass([]);
        const { x, y, width, height } = card.getBoundingClientRect();
        onGlass([
            { material: 'popover', x: x - RADIUS, y, width: width + RADIUS, height, cornerRadius: RADIUS },
            ...(menu ? [{ material: 'menu', ...menu.frame, cornerRadius: menu.radius }] : []),
        ]);
    }

    return { element: root, update, setTop };
}

// MARK: - Private
// A slide or a fade, not the card's tint easing in or out.
function isMove({ transitionProperty }) {
    return transitionProperty !== 'background-color';
}

// `node` at `rect` in what it is placed against.
function place(node, { x, y, width, height }) {
    Object.assign(node.style, { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px' });
    return node;
}

function tag(name, className) {
    const made = document.createElement(name);
    made.className = className;
    return made;
}

export { make };
