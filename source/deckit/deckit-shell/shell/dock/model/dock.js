// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The Dock's items, `{ id, pinned, running }`, of `ids`, in the list's order: those the person keeps in the Dock
// (`pinned`), as the order has them, then those running now that are not kept.
function items(ids, { pinned, running }) {
    const kept = ids.filter((id) => pinned.has(id));
    const others = ids.filter((id) => !pinned.has(id) && running.has(id));
    return [...kept, ...others].map((id) => ({ id, pinned: pinned.has(id), running: running.has(id) }));
}

// MARK: - Private

export { items };
