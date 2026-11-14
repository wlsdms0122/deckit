// The page a press at a point of a stage reaches, read from the layers as they are laid, bottom to top, and from no
// view: `[{ page, frame, clips, input } | { page, hidden: true } | { material, frame }]`, a page taking the press
// inside its frame, inside every clip it is cut to, a clip's corners rounded by its `cornerRadius`, and inside one of
// its `input` rects where it has them, a material and a hidden page taking none. Answers `{ page, x, y }`, the point
// from the page's top left, or null where the press reaches no page.
export function hitIn(layers, { x, y }) {
    for (const { page, material, frame, hidden, clips = [], input = null } of [...layers].reverse()) {
        if (material || hidden || !frame || !isIn(frame, x, y)) continue;
        if (!clips.every((clip) => isInRounded(clip, x, y))) continue;
        const at = { x: x - frame.x, y: y - frame.y };
        if (input && !input.some((rect) => isIn(rect, at.x, at.y))) continue;
        return { page, ...at };
    }
    return null;
}

// MARK: - Private
function isIn({ x, y, width, height }, px, py) {
    return px >= x && px < x + width && py >= y && py < y + height;
}

// Inside a rect whose corners are rounded: past a corner's square, inside the circle that rounds it.
function isInRounded(rect, px, py) {
    if (!isIn(rect, px, py)) return false;
    const radius = Math.min(rect.cornerRadius || 0, rect.width / 2, rect.height / 2);
    if (radius <= 0) return true;
    const cx = Math.max(rect.x + radius, Math.min(px, rect.x + rect.width - radius));
    const cy = Math.max(rect.y + radius, Math.min(py, rect.y + rect.height - radius));
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}
