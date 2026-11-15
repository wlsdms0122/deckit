// How what a seat's devices did finds where it goes, as plain data: the route of each kind of event, how a pointer
// event names its place, and what waits for what.

// The route of each kind of event: `place`, where the seat's pointer is, or `keyboard`, what holds the seat's keyboard.
const ROUTES = Object.freeze({ pointer: 'place', key: 'keyboard', text: 'keyboard' });

// The route of `event`, or null for one of no kind.
function routeOf(event) {
    return Object.hasOwn(ROUTES, event?.event) ? ROUTES[event.event] : null;
}

// How a pointer event names its place: 'point' for the desktop point `x`, `y`, 'ref' for what a reading named, and
// null for one that names none or both.
function placeOf({ x, y, ref }) {
    const point = x !== undefined || y !== undefined;
    if (point === (ref !== undefined)) return null;
    if (point) return [x, y].every(Number.isFinite) ? 'point' : null;
    return typeof ref === 'string' && ref ? 'ref' : null;
}

// Whether an event waits its turn behind the seat's last: a ref is made a point over time, so one placed by a ref
// waits, and so does every event that enters while one of the seat's still waits (`waiting`). One the environment
// carried is in its page already and waits for nothing.
function waits(event, waiting) {
    if (event.carried) return false;
    return waiting || event.ref !== undefined;
}

// Whether a pointer that only moves is refused: no page hears a lone move, so one sent to what a reading named, with
// no button of the seat's held, would do nothing a seat could see.
function hovers({ type, ref }, buttons) {
    return type === 'move' && ref !== undefined && buttons.length === 0;
}

// Whether the window a ref is of comes to the front of the seat's order before the pointer goes to it: `window` is
// that window's id, or null for a ref of no window, and `reached` the id of the window a press at the ref's place
// reaches in that order now, or null where it reaches none.
function raises(window, reached) {
    return window !== null && reached !== null && reached !== window;
}

export { ROUTES, routeOf, placeOf, waits, hovers, raises };
