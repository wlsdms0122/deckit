// What marks a seat on the screen of the seat that views it, as plain data.

// How long the name beside a seat's cursor shows after its pointer's last act, ms.
const NAME = 1500;
// The ring round what a seat types in, px: its `room` off the field, its `line`'s width, and its corners' `radius`
// round a field the radius of whose corners is not known.
const RING = Object.freeze({ room: 2, line: 1, radius: 4 });

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

// How long the name beside a seat's cursor still shows, ms: for NAME from its pointer's last act, a move, a press, a
// let go or a scroll, at `acted` on the clock that reads `now`, or null for a pointer that did nothing yet. At 0 the
// name is folded and the arrow is drawn alone.
function nameLeft(acted, now) {
    return acted === null ? 0 : Math.max(0, NAME - (now - acted));
}

// The ring drawn round the field at `rect`, `{ x, y, width, height, radius, line }`: a line RING.line wide that leaves
// RING.room between it and the field on every side, its corners round the field's, whose radius is `radius`, or of
// RING.radius where that is not known, null.
function ringOf({ x, y, width, height }, radius = null) {
    const out = RING.room + RING.line;
    return {
        x: x - out,
        y: y - out,
        width: width + 2 * out,
        height: height + 2 * out,
        radius: radius === null ? RING.radius : radius + out,
        line: RING.line,
    };
}

export { NAME, RING, topAt, isDimmed, nameLeft, ringOf };
