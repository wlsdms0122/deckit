// MARK: - Property
// The Dock at the desktop's left edge: the sliver of it that shows while it is in, and how wide it is out.
const SLIVER = 6;
const WIDTH = 64;

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

// MARK: - Private

export { SLIVER, WIDTH, items, dragged, rectOf };
