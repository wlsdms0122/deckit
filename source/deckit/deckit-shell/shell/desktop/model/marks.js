// What marks a seat on the screen of the seat that views it, as plain data.

// The id of what is in front at `point` in `stack`, `[{ id, frame }]` from the back, or null where none of it is.
function topAt(stack, { x, y }) {
    const at = stack.findLast(
        ({ frame }) => x >= frame.x && y >= frame.y && x < frame.x + frame.width && y < frame.y + frame.height
    );
    return at ? at.id : null;
}

// Whether a seat's cursor is drawn dimmed: its pointer, at `point`, is over a window in front there in the seat's own
// order, `own`, and another window covers that point in the viewer's order, `viewed`, each `[{ id, frame }]` from the
// back. A seat works in its own order, so the viewer sees such a cursor on a window the seat does not point at.
function isDimmed(point, own, viewed) {
    if (!point) return false;
    const [over, top] = [topAt(own, point), topAt(viewed, point)];
    return over !== null && top !== null && top !== over;
}

export { topAt, isDimmed };
