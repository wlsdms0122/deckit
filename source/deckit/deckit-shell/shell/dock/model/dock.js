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

// Where the Dock takes the pointer on `desktop`: its sliver at the left edge, or all of it while it is `out`.
function rectOf(desktop, out) {
    return { x: desktop.x, y: desktop.y, width: out ? WIDTH : SLIVER, height: desktop.height };
}

// Where the item `id` of `items`, as items() answers them, stands on `desktop` with the Dock out, as its view lays it,
// or null where it is none of them.
function tileOf(desktop, items, id) {
    const at = items.findIndex((item) => item.id === id);
    if (at < 0) return null;
    const kept = items.filter(({ pinned }) => pinned).length;
    const step = CARD.item + CARD.gap;
    const run = (count) => (count ? count * step - CARD.gap : 0);
    const divider = kept && items.length > kept ? 1 + 3 * CARD.gap : 0;
    const height = 2 * CARD.padding + run(kept) + CARD.gap + divider + run(items.length - kept);
    const top = desktop.y + Math.max(CARD.padding, (desktop.height - height) / 2) + CARD.padding;
    const y = at < kept ? top + at * step : top + run(kept) + CARD.gap + divider + (at - kept) * step;
    const x = desktop.x + (WIDTH - CARD.item) / 2;
    return { x, y: Math.round(y), width: CARD.item, height: CARD.item };
}

// MARK: - Private

export { SLIVER, WIDTH, RADIUS, CARD, items, dragged, rectOf, tileOf };
