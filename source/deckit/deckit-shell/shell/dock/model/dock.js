// MARK: - Property
// The Dock at the desktop's left edge: the sliver of it that shows while it is in, and how wide it is out.
const SLIVER = 6;
const WIDTH = 64;
// The card's outer corners: an item's corner (12) plus the card's padding (8), so the two are concentric.
const RADIUS = 20;
// The card the items stand in, down the Dock and centred on the desktop's height: its padding, the size of an item, the
// room between items, and between the items kept and those running, a hairline with that room above and below it.
const CARD = Object.freeze({ padding: 8, item: 48, gap: 4 });

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
// desktop's left edge, down all of it, which brings it out and keeps it out while the pointer stays there, and while it
// is `out` its card too, where it is drawn. A window under the rest of the column takes the pointer there.
function inputOf(desktop, out, items) {
    const sliver = { x: desktop.x, y: desktop.y, width: SLIVER, height: desktop.height };
    return out ? [sliver, cardOf(desktop, items)] : [sliver];
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
    const x = desktop.x + (WIDTH - CARD.item) / 2;
    return { x, y: Math.round(y), width: CARD.item, height: CARD.item };
}

// The card the Dock's `items` stand in on `desktop`, out, as its view lays it: centred down the desktop, its padding
// clear of the desktop's top and bottom, and no taller than the room between them.
function cardOf(desktop, items) {
    const kept = items.filter(({ pinned }) => pinned).length;
    const tall = 2 * CARD.padding + runOf(kept) + CARD.gap + dividerOf(items) + runOf(items.length - kept);
    const height = Math.min(tall, Math.max(0, desktop.height - 2 * CARD.padding));
    const y = desktop.y + Math.max(CARD.padding, (desktop.height - tall) / 2);
    return { x: desktop.x, y: Math.round(y), width: WIDTH, height: Math.round(height) };
}

// What the Dock's card covers of `desktop` with `items`, `{ frame, radius }`: its card while `out`, and while it is in
// that card slid off the desktop's left edge but for its sliver. The frame reaches RADIUS past the left edge, so that
// corners of that radius round its outer side alone.
function coverOf(desktop, out, items) {
    const { x, y, width, height } = cardOf(desktop, items);
    const left = out ? x : x - (WIDTH - SLIVER);
    return { frame: { x: left - RADIUS, y, width: width + RADIUS, height }, radius: RADIUS };
}

// MARK: - Private
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

export { SLIVER, WIDTH, RADIUS, CARD, items, dragged, inputOf, tileOf, cardOf, coverOf };
