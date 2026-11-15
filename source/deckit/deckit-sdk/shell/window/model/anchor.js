// MARK: - Property
// An anchor is a rect a window's mod names in the window's content, for one mod to stand a view of its own under.
// The longest id of an anchor and of a mod.
const LONGEST = 128;
const SIDES = Object.freeze(['x', 'y', 'width', 'height']);

// MARK: - Initializer
// MARK: - Public
// The anchors a window's mod tells, as they are kept, `[{ id, rect, mod }]`: `id` what the anchor is named by among
// its mod's, `rect` `{ x, y, width, height }` in the window's content, and `mod` the id of the one mod that may bind
// to it. Null for another shape, or for an id named twice.
function heldTo(anchors) {
    if (!Array.isArray(anchors)) return null;
    const held = anchors.map((anchor) => {
        const rect = rectOf(anchor?.rect);
        return rect && named(anchor.id) && named(anchor.mod) ? { id: anchor.id, rect, mod: anchor.mod } : null;
    });
    if (held.includes(null) || new Set(held.map(({ id }) => id)).size !== held.length) return null;
    return held;
}

// What a view binds by, `{ mod, id }`: the mod whose window tells the anchor, and the anchor's id. Null for another
// shape.
function nameOf(anchor) {
    return named(anchor?.mod) && named(anchor?.id) ? { mod: anchor.mod, id: anchor.id } : null;
}

// MARK: - Private
function named(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= LONGEST;
}

// A rect as it is kept, no wider and no higher than 0 at the least; or null.
function rectOf(rect) {
    if (!rect || typeof rect !== 'object' || !SIDES.every((side) => Number.isFinite(rect[side]))) return null;
    if (rect.width < 0 || rect.height < 0) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export { heldTo, nameOf };
