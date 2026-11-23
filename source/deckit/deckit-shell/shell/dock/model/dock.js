import * as TOKEN from '../../../../deckit-sdk/shell/ui/token/index.js';

// MARK: - Property
// The Dock along the desktop's left edge: the sliver of it that shows while it is in, how far its card stands from the
// edge while it is out, a floating surface's margin, and how wide the card is.
const SLIVER = 6;
const EDGE = TOKEN.FLOAT.margin;
const WIDTH = 64;
// The card's corners, every one: an item's corner (12) plus the card's padding (8), so the two are concentric.
const RADIUS = 20;
// The card the items stand in, down the Dock and centred on the desktop's height, EDGE clear of its top and bottom:
// its padding, the size of an item, the room between items, and between the items kept and those running, a hairline
// with that room above and below it.
const CARD = Object.freeze({ padding: 8, item: 48, gap: 4 });
// How far the pointer goes from its press on an item kept in the Dock before it drags the item.
const SLOP = 4;
// An item's menu, beside the card: how far right of the card it stands, how wide it is, the padding round its entries,
// how tall an entry and a rule between entries stand, the radius of its corners, and the room it keeps from the
// desktop's top and bottom.
const MENU = Object.freeze({ beside: 8, width: 160, padding: 4, entry: 28, rule: 9, radius: 10, margin: 8 });

// MARK: - Initializer
// MARK: - Public
// The Dock's items, `{ id, pinned, running }`, of `ids`, in the list's order: those the person keeps in the Dock
// (`pinned`), as the order has them, then those running now that are not kept, in the order `running` has them.
function items(ids, { pinned, running }) {
    const kept = ids.filter((id) => pinned.has(id));
    const others = [...running].filter((id) => !pinned.has(id) && ids.includes(id));
    return [...kept, ...others].map((id) => ({ id, pinned: pinned.has(id), running: running.has(id) }));
}

// The ids of the items kept in the Dock, `ids` in their order, once the person drags the item `id` onto the place of
// the item `to`: `id` takes that place, and the items between shift by one. Answers `ids` where either is not there.
function dragged(ids, id, to) {
    const at = ids.indexOf(to);
    if (!ids.includes(id) || at < 0) return ids;
    const rest = ids.filter((one) => one !== id);
    return [...rest.slice(0, at), id, ...rest.slice(at)];
}

// Where the Dock takes the pointer on `desktop` with `items`, as items() answers them, its rects: the sliver at the
// desktop's left edge, down all of it, which brings it out and keeps it out while the pointer stays there, while it
// is `out` its card too, where it is drawn, with the room between it and the edge, and the `menu` of an item, as
// menuOf() answers it, while one is open. A window under the rest of the column takes the pointer there.
function inputOf(desktop, out, items, menu = null) {
    const sliver = { x: desktop.x, y: desktop.y, width: SLIVER, height: desktop.height };
    const card = cardOf(desktop, items);
    const reach = { ...card, x: desktop.x, width: card.x + card.width - desktop.x };
    return [sliver, ...(out ? [reach] : []), ...(menu ? [menu.frame] : [])];
}

// The id of the item of `items` that stands at `point` on `desktop` with the Dock out, or null.
function itemAt(desktop, items, point) {
    return items.find(({ id }) => within(tileOf(desktop, items, id), point))?.id ?? null;
}

// Whether a pointer pressed on an item at `from` and now at `point` went far enough to drag it.
function drags(from, point) {
    return Math.abs(point.x - from.x) >= SLOP || Math.abs(point.y - from.y) >= SLOP;
}

// The ids of the items kept in the Dock, in the order they show while the item `id` is dragged with the pointer at
// `point` on `desktop`: `id` at the place of the kept item the pointer is level with, the first above them all and
// the last below, the others shifted by one. Let go there, it is their order. Null where `id` is not kept.
function orderOf(desktop, items, id, point) {
    const kept = items.filter(({ pinned }) => pinned).map((item) => item.id);
    if (!kept.includes(id)) return null;
    const top = cardOf(desktop, items).y + CARD.padding - CARD.gap / 2;
    const place = Math.floor((point.y - top) / (CARD.item + CARD.gap));
    return dragged(kept, id, kept[Math.min(kept.length - 1, Math.max(0, place))]);
}

// What the menu of `item` offers, top to bottom, each `{ id, label }`, null a rule between two: 'open', which opens
// its mod or shows it while it runs; 'keep', which keeps it in the Dock or takes it out; and 'quit' while it runs.
function entriesOf({ pinned, running }) {
    return [
        { id: 'open', label: running ? 'Show' : 'Open' },
        null,
        { id: 'keep', label: pinned ? 'Remove from Dock' : 'Keep in Dock' },
        ...(running ? [null, { id: 'quit', label: 'Quit' }] : []),
    ];
}

// The menu of the item `id` of `items` on `desktop`, `{ item, frame, radius, entries, rules }`: beside the card, its
// top level with the item's and inside the desktop, `entries` `[{ id, label, rect }]` and `rules` the rects of the
// rules between them, each on the desktop. Null where `id` is none of the items.
function menuOf(desktop, items, id) {
    const item = items.find((one) => one.id === id);
    if (!item) return null;
    const listed = entriesOf(item);
    const height = 2 * MENU.padding + listed.reduce((sum, entry) => sum + (entry ? MENU.entry : MENU.rule), 0);
    const x = desktop.x + EDGE + WIDTH + MENU.beside;
    const lowest = desktop.y + desktop.height - MENU.margin - height;
    const y = Math.max(desktop.y + MENU.margin, Math.min(tileOf(desktop, items, id).y, lowest));
    const [entries, rules] = [[], []];
    let top = y + MENU.padding;
    for (const entry of listed) {
        const tall = entry ? MENU.entry : MENU.rule;
        const rect = { x: x + MENU.padding, y: top, width: MENU.width - 2 * MENU.padding, height: tall };
        if (entry) entries.push({ ...entry, rect });
        else rules.push(rect);
        top += tall;
    }
    return { item: id, frame: { x, y, width: MENU.width, height }, radius: MENU.radius, entries, rules };
}

// The id of the entry of `menu`, as menuOf() answers it, at `point` on the desktop, or null.
function entryAt(menu, point) {
    return menu.entries.find(({ rect }) => within(rect, point))?.id ?? null;
}

// Where the item `id` of `items`, as items() answers them, stands on `desktop` with the Dock out, as its view lays it,
// or null where it is none of them.
function tileOf(desktop, items, id) {
    const at = items.findIndex((item) => item.id === id);
    if (at < 0) return null;
    const kept = items.filter(({ pinned }) => pinned).length;
    const step = CARD.item + CARD.gap;
    const top = cardOf(desktop, items).y + CARD.padding;
    const y = at < kept ? top + at * step : top + runOf(kept) + CARD.gap + dividerOf(items) + (at - kept) * step;
    const x = desktop.x + EDGE + (WIDTH - CARD.item) / 2;
    return { x, y: Math.round(y), width: CARD.item, height: CARD.item };
}

// The card the Dock's `items` stand in on `desktop`, out, as its view lays it: EDGE in from the desktop's left edge,
// centred down the desktop, EDGE clear of its top and bottom, and no taller than the room between them.
function cardOf(desktop, items) {
    const kept = items.filter(({ pinned }) => pinned).length;
    const tall = 2 * CARD.padding + runOf(kept) + CARD.gap + dividerOf(items) + runOf(items.length - kept);
    const height = Math.min(tall, Math.max(0, desktop.height - 2 * EDGE));
    const y = desktop.y + Math.max(EDGE, (desktop.height - tall) / 2);
    return { x: desktop.x + EDGE, y: Math.round(y), width: WIDTH, height: Math.round(height) };
}

// What the Dock's card covers of `desktop` with `items`, `{ frame, radius }`: its card while `out`, and while it is in
// that card slid left until only its sliver shows inside the desktop's left edge.
function coverOf(desktop, out, items) {
    const { x, y, width, height } = cardOf(desktop, items);
    const left = out ? x : desktop.x + SLIVER - width;
    return { frame: { x: left, y, width, height }, radius: RADIUS };
}

// MARK: - Private
function within({ x, y, width, height }, point) {
    return point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;
}

// How tall `count` items stand in a row down the card, the room between them included.
function runOf(count) {
    return count ? count * (CARD.item + CARD.gap) - CARD.gap : 0;
}

// How tall the hairline between the items kept and those running stands, with the room above and below it, where
// there are both.
function dividerOf(items) {
    const kept = items.filter(({ pinned }) => pinned).length;
    return kept && items.length > kept ? 1 + 3 * CARD.gap : 0;
}

export {
    SLIVER,
    EDGE,
    WIDTH,
    RADIUS,
    CARD,
    SLOP,
    MENU,
    items,
    dragged,
    inputOf,
    itemAt,
    drags,
    orderOf,
    entriesOf,
    menuOf,
    entryAt,
    tileOf,
    cardOf,
    coverOf,
};
