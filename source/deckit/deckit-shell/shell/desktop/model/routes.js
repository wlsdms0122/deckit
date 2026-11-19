// How what a seat's devices did finds where it goes, as plain data: the route of each kind of event, how a pointer
// event names its place, and what waits for what.

// The route of each kind of event: `place`, where the seat's pointer is, `keyboard`, what holds the seat's keyboard, or
// `sizing`, the seat's screen and its camera.
const ROUTES = Object.freeze({ pointer: 'place', key: 'keyboard', text: 'keyboard', ['screen']: 'sizing' });

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

// The first of `names` whose value in `given` is written and is no count, an integer of 0 or more, or null.
function noCount(given, names) {
    return names.find((name) => given[name] != null && !(Number.isInteger(given[name]) && given[name] >= 0)) ?? null;
}

// Whether an event waits its turn behind the seat's last: a ref is made a point over time, so one placed by a ref
// waits, and so does every event that enters while one of the seat's still waits (`waiting`). One the environment
// carried is in its page already and waits for nothing.
function waits(event, waiting) {
    if (event.carried) return false;
    return waiting || event.ref !== undefined;
}

// Whether a pointer event only moves: a move with no button of the seat's held, `buttons`. It reaches what lies at its
// place as a press would, and presses nothing.
function hovers({ type }, buttons) {
    return type === 'move' && buttons.length === 0;
}

// Where the one pointer of each page stands once `seat` moved with no button held into `page`, or into no page where
// it is null. `placed` is `[{ page, seat }]`, each page whose pointer a seat's move placed last: a page has one pointer
// whoever moves it. Answers `{ placed, left }`, `left` the pages whose pointer that seat placed and that move left.
function hovered(placed, seat, page) {
    const left = placed.filter((one) => one.seat === seat && one.page !== page).map((one) => one.page);
    const kept = placed.filter((one) => one.seat !== seat && one.page !== page);
    return { placed: page === null ? kept : [...kept, { page, seat }], left };
}

// Whether the window a ref is of comes to the front of the seat's order before the pointer goes to it: `window` is
// that window's id, or null for a ref of no window, and `reached` the id of the window a press at the ref's place
// reaches in that order now, or null where it reaches none.
function raises(window, reached) {
    return window !== null && reached !== null && reached !== window;
}

export { ROUTES, routeOf, placeOf, noCount, waits, hovers, hovered, raises };
