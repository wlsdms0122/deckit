// MARK: - Property
// What taking a view's keyboard answers: the seat holds it now, or another seat does.
const KEY = 'key';
const HELD = 'held';

// MARK: - Initializer
// MARK: - Public
// On which seats' screens each view is. A view is open while its mod keeps it, and is on a seat's screen only where
// it was shown for that seat: for every seat, where nothing ties it to anyone's input, or for the seats its mod may
// activate for, one view a seat, which is put away for a seat again. The keyboard of a seat a view is shown for by
// activation is the view's: one seat holds it, the first it was shown for, and it is given back as the view is put
// away for that seat. Views are named by their ids, seats by the tokens the caller keeps; `isIdle(seat)` answers
// whether a holder gives the keyboard up, and `onTaken(holder, view, by)` hears it.
function createShowing({ isIdle = () => false, onTaken = () => {} } = {}) {
    // MARK: - Property
    const seats = new Map(); // seat -> the view shown for it by activation, or null
    const views = new Map(); // view -> { every, holder }: whether it is shown for every seat, and who holds its keyboard

    // MARK: - Public
    function addSeat(seat) {
        if (!seats.has(seat)) seats.set(seat, null);
    }

    // A seat leaves: the view shown for it is put away for it.
    function removeSeat(seat) {
        putAway(seat);
        seats.delete(seat);
    }

    // A view opens: with `activates` false it is shown for every seat, as nothing ties it to anyone's input; else for
    // each of `seats`, those its mod may activate for, as show has it.
    function open(view, { activates = true, seats: forSeats = [] } = {}) {
        views.set(view, { every: !activates, holder: null });
        if (activates) show(view, forSeats);
    }

    // A view closes: it is on no screen.
    function close(view) {
        if (!views.delete(view)) return;
        for (const [seat, shown] of seats) if (shown === view) seats.set(seat, null);
    }

    // Shown for each of `forSeats`, the seats its mod may activate for: the view each had is put away for it, one a
    // seat, and the keyboard of the view is taken for the first that no other holds it against.
    function show(view, forSeats) {
        if (!views.has(view)) return;
        for (const seat of forSeats) {
            if (!seats.has(seat) || seats.get(seat) === view) continue;
            putAway(seat);
            seats.set(seat, view);
            take(seat);
        }
    }

    // For each of `forSeats`, the seats its mod may activate for: put away where it is shown by activation, then shown
    // where it was not, so a keyboard given back is there to take.
    function toggle(view, forSeats) {
        if (!views.has(view)) return;
        const had = forSeats.filter((seat) => seats.get(seat) === view);
        for (const seat of had) putAway(seat);
        show(
            view,
            forSeats.filter((seat) => !had.includes(seat))
        );
    }

    // The view shown for `seat` by activation is put away for it, its keyboard given back where the seat held it: as
    // a window becomes the seat's key window, at Escape the view left unhandled, at Close Window, and as the seat
    // begins to follow another. Answers whether one was.
    function putAway(seat) {
        const view = seats.get(seat) ?? null;
        if (view === null) return false;
        seats.set(seat, null);
        const held = views.get(view);
        if (held?.holder === seat) held.holder = null;
        return true;
    }

    // The seat pressed down: its view is put away unless the press spares it, `spared` the views it is in, in what
    // they present over themselves, or on the anchor of. Answers whether one was.
    function pressed(seat, spared = []) {
        const view = seats.get(seat) ?? null;
        return view !== null && !spared.includes(view) && putAway(seat);
    }

    // The view's anchor went: it is put away for every seat it was shown for by activation. Answers whether it was
    // for any.
    function unanchored(view) {
        const had = seatsOf(view);
        for (const seat of had) putAway(seat);
        return had.length > 0;
    }

    // The keyboard of the view shown for `seat` by activation, taken for it: answers KEY where it holds it now, HELD
    // where another seat does and is not idle, and null where no view is shown for it so. An idle holder gives it up.
    function take(seat) {
        const view = seats.get(seat) ?? null;
        const held = views.get(view);
        if (!held) return null;
        if (held.holder === seat) return KEY;
        if (held.holder !== null) {
            if (!isIdle(held.holder)) return HELD;
            onTaken(held.holder, view, seat);
        }
        held.holder = seat;
        return KEY;
    }

    // The view shown for `seat` by activation, or null.
    function of(seat) {
        return seats.get(seat) ?? null;
    }

    // The view whose keyboard `seat` holds, or null.
    function heldBy(seat) {
        const view = seats.get(seat) ?? null;
        return view !== null && views.get(view)?.holder === seat ? view : null;
    }

    // The seat that holds the view's keyboard, or null.
    function holderOf(view) {
        return views.get(view)?.holder ?? null;
    }

    // The seats the view is shown for by activation, in the order they sat.
    function seatsOf(view) {
        return [...seats].filter(([, shown]) => shown === view).map(([seat]) => seat);
    }

    // Whether the view is on `seat`'s screen: shown for every seat, or for it.
    function isOn(seat, view) {
        return seats.has(seat) && (!!views.get(view)?.every || seats.get(seat) === view);
    }

    // Whether the view is on some seat's screen.
    function isShown(view) {
        return [...seats.keys()].some((seat) => isOn(seat, view));
    }

    return {
        addSeat,
        removeSeat,
        open,
        close,
        show,
        toggle,
        putAway,
        pressed,
        unanchored,
        take,
        of,
        heldBy,
        holderOf,
        seatsOf,
        isOn,
        isShown,
    };
}

export { KEY, HELD, createShowing };
