// What marks a seat on the screen of the seat that views it, as plain data.
import * as CAMERA from './camera.js';

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

// What covers, on the viewer's screen, what a seat's pointer at `point` is over, from the back: `[{ x, y, width,
// height, radius }]` on the stage, each with the radius of its corners. `own` is what stands on the seat's own screen
// and `viewed` what stands on the viewer's, each `[{ id, frame, radius }]` from the back. The pointer is over what is
// in front at it on its own screen, or the bare desktop under all of it, and a cursor is in the layer of what its
// pointer is over: all that lies over that on the viewer's screen covers it. Null where what the pointer is over is
// not on the viewer's screen, so nothing of the cursor is seen; nothing for a pointer that is nowhere yet.
function underOf(point, own, viewed) {
    if (!point) return [];
    const over = topAt(own, point);
    const at = over === null ? -1 : viewed.findIndex(({ id }) => id === over);
    if (over !== null && at < 0) return null;
    return viewed
        .slice(at + 1)
        .map(({ frame: { x, y, width, height }, radius = 0 }) => ({ x, y, width, height, radius }));
}

// How far a seat's cursor is drawn across and down from its point, px: the room a mark at a screen's edge leaves it.
const MARK = 16;

// Where the cursor of a seat whose pointer is at `point` of the plane is drawn on the screen `camera` shows, and what
// covers it there: `{ at, under }`, `at` from the screen's top left and `under` as underOf answers it of `own` and
// `viewed`, each rect on that screen. A pointer outside the camera is drawn as a mark at the camera's edge toward it,
// the nearest point of the camera that leaves the mark MARK across and down in it, under nothing; one nowhere yet is
// at null, under nothing.
function cursorOn(camera, point, own, viewed) {
    if (!point) return { at: null, under: [] };
    if (!CAMERA.reaches(camera, point)) {
        const along = (at, from, length) => Math.min(Math.max(at - from, 0), Math.max(0, length - MARK));
        return {
            at: { x: along(point.x, camera.x, camera.width), y: along(point.y, camera.y, camera.height) },
            under: [],
        };
    }
    const under = underOf(point, own, viewed);
    const { x, y } = CAMERA.onScreen(camera, point);
    return { at: { x, y }, under: under && under.map((rect) => CAMERA.onScreen(camera, rect)) };
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

// Whether a seat's cursor glides to where a pointer event puts it, by how the event named its place (model/routes.js
// placeOf): only for 'ref', where the pointer jumps to what a reading named. A pointer that moves is drawn where it
// is at once, each event as it comes.
function glides(place) {
    return place === 'ref';
}

// The share of a ring's length the seat `at` of the `count` that share it has, the seats side by side in their order:
// `[before, after]`, how much of the length lies before its share and after it, in hundredths.
function sharesOf(count, at) {
    return [(100 * at) / count, (100 * (count - at - 1)) / count];
}

// Whether the marks that tell seats apart, each seat's cursor and the ring round its key window, are drawn: while more
// than one of `count` seats sits.
function apart(count) {
    return count > 1;
}

export { NAME, RING, MARK, topAt, underOf, cursorOn, nameLeft, ringOf, glides, sharesOf, apart };
