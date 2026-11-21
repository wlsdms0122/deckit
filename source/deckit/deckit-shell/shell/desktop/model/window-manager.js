// MARK: - Initializer
// MARK: - Public
// The desktop's windows as every seat shares them, each with its frame and its minimum size, and each seat's own: its
// order, back to front, its key window and the windows it minimized. A seat is one user's pointer and keyboard, named
// by a token the caller keeps; every operation is one seat's. A seat's key window is its own: a window is the key
// window of any number of seats at once, and nothing of one seat changes another's.
// Frames are `{ x, y, width, height }`, never below the window's `minimum` `{ width, height }`.
function createWindowManager() {
    // MARK: - Property
    // id -> { frame, minimum, zoomed, tiled }: `zoomed` the frame zoom left, or null; `tiled` `{ name, before }`, the
    // tile it is in and the frame it had before, or null
    const windows = new Map();
    const seats = new Map(); // seat -> { order, key, minimized }

    // MARK: - Public
    // A seat sits down: it sees every window open, in the order they opened.
    function addSeat(seat) {
        if (!seats.has(seat)) seats.set(seat, { order: [...windows.keys()], key: null, minimized: new Set() });
    }

    // A seat leaves: its key window is its no more.
    function removeSeat(seat) {
        seats.delete(seat);
    }

    // A window opens, `by` a seat: right behind each seat's key window, or in front for a seat with none. A seat it is
    // brought forward for orders it front.
    function open(_by, id, { frame, minimum }) {
        windows.set(id, { frame: fitted(frame, minimum), minimum, zoomed: null, tiled: null });
        for (const seat of seats.values()) seat.order = behindKey(seat, id);
    }

    // A window closes for every seat; a seat whose key window it was makes key the next in its order.
    function close(_by, id) {
        if (!windows.delete(id)) return;
        for (const [name, seat] of seats) {
            seat.order = seat.order.filter((one) => one !== id);
            seat.minimized.delete(id);
            if (seat.key !== id) continue;
            seat.key = null;
            next(name);
        }
    }

    // In front in `by`'s order, out of what it minimized, and its key window unless `activates` is false: answers
    // whether it is its key window after.
    function orderFront(by, id, { activates = true } = {}) {
        const seat = seats.get(by);
        if (!seat || !windows.has(id)) return false;
        seat.minimized.delete(id);
        seat.order = [...seat.order.filter((one) => one !== id), id];
        return activates ? makeKey(by, id) : seat.key === id;
    }

    // Right behind `by`'s key window in its order, or in front where it has none, out of what it minimized, and not
    // key: one in front of the key window already stays there.
    function orderBehindKey(by, id) {
        const seat = seats.get(by);
        if (!seat || !windows.has(id)) return;
        seat.minimized.delete(id);
        const key = seat.order.indexOf(seat.key);
        if (key >= 0 && seat.order.indexOf(id) > key) return;
        seat.order = behindKey(seat, id);
    }

    // `by`'s key window, whichever other seats' key window it is: answers whether it is, which it is not while `by`
    // has it minimized.
    function makeKey(by, id) {
        const seat = seats.get(by);
        if (!seat || !windows.has(id) || seat.minimized.has(id)) return false;
        seat.key = id;
        return true;
    }

    // Out of `by`'s view; its key window the next in its order if it was this one.
    function minimize(by, id) {
        const seat = seats.get(by);
        if (!seat || !windows.has(id)) return;
        seat.minimized.add(id);
        if (seat.key !== id) return;
        seat.key = null;
        next(by);
    }

    // The frame every seat sees, no smaller than the window's minimum: a frame set ends a zoom and a tile.
    function setFrame(_by, id, frame) {
        const window = windows.get(id);
        if (!window) return;
        window.frame = fitted(frame, window.minimum);
        window.zoomed = null;
        window.tiled = null;
    }

    // Zoomed to `area`, or back to the frame it had before: a tiled window fills it and goes back to its tile.
    function zoom(_by, id, area) {
        const window = windows.get(id);
        if (!window) return;
        const back = window.zoomed;
        window.zoomed = back ? null : window.frame;
        window.frame = back ?? fitted(area, window.minimum);
    }

    // In the tile `name` at `frame`, not zoomed: the frame it had before it took a tile is kept for its return.
    function tile(_by, id, name, frame) {
        const window = windows.get(id);
        if (!window) return;
        const before = window.tiled?.before ?? window.zoomed ?? window.frame;
        window.tiled = { name, before };
        window.zoomed = null;
        window.frame = fitted(frame, window.minimum);
    }

    // Out of its tile, at the frame it had before it took one, or at `frame` where it is given.
    function untile(_by, id, frame = null) {
        const window = windows.get(id);
        if (!window?.tiled) return;
        window.frame = fitted(frame ?? window.tiled.before, window.minimum);
        window.tiled = null;
        window.zoomed = null;
    }

    // The windows on `seat`'s screen, back to front, without those it minimized: `[{ id, frame }]`.
    function viewOf(seat) {
        const own = seats.get(seat);
        if (!own) return [];
        return own.order.filter((id) => !own.minimized.has(id)).map((id) => ({ id, frame: windows.get(id).frame }));
    }

    function keyOf(seat) {
        return seats.get(seat)?.key ?? null;
    }

    // `seat`'s order, back to front, minimized ones too.
    function orderOf(seat) {
        return [...(seats.get(seat)?.order ?? [])];
    }

    function isMinimized(seat, id) {
        return !!seats.get(seat)?.minimized.has(id);
    }

    // On some seat's screen: not minimized by every one.
    function isShown(id) {
        return windows.has(id) && [...seats.values()].some((seat) => !seat.minimized.has(id));
    }

    // The seats whose key window it is, in the order they sat.
    function seatsOf(id) {
        return [...seats].filter(([, seat]) => seat.key === id).map(([name]) => name);
    }

    function frameOf(id) {
        return windows.get(id)?.frame ?? null;
    }

    function isZoomed(id) {
        return !!windows.get(id)?.zoomed;
    }

    // The tile it is in, zoomed or not, or null.
    function tileNameOf(id) {
        return windows.get(id)?.tiled?.name ?? null;
    }

    // The frame a seat set it to: the one it had before it took a tile, while tiled, the one zoom left, while zoomed,
    // or the frame.
    function standardFrameOf(id) {
        const window = windows.get(id);
        return window ? (window.tiled?.before ?? window.zoomed ?? window.frame) : null;
    }

    // MARK: - Private
    // The front-most window of `name`'s order it has not minimized becomes its key window.
    function next(name) {
        const seat = seats.get(name);
        const id = seat.order.findLast((one) => !seat.minimized.has(one));
        if (id !== undefined) makeKey(name, id);
    }

    // The seat's order with `id` right behind its key window, or in front where it has none.
    function behindKey(seat, id) {
        const order = seat.order.filter((one) => one !== id);
        const key = order.indexOf(seat.key);
        return key < 0 ? [...order, id] : [...order.slice(0, key), id, ...order.slice(key)];
    }

    function fitted({ x, y, width, height }, minimum) {
        return { x, y, width: Math.max(width, minimum.width), height: Math.max(height, minimum.height) };
    }

    return {
        addSeat,
        removeSeat,
        open,
        close,
        orderFront,
        orderBehindKey,
        makeKey,
        minimize,
        setFrame,
        zoom,
        tile,
        untile,
        viewOf,
        keyOf,
        orderOf,
        isMinimized,
        isShown,
        seatsOf,
        isZoomed,
        frameOf,
        tileNameOf,
        standardFrameOf,
    };
}

export { createWindowManager };
