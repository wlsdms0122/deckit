// MARK: - Initializer
// MARK: - Public
// On which seats' screens each view is. A view is open while its mod keeps it, and is on a seat's screen only where
// it was shown for that seat: for every seat, where nothing ties it to anyone's input, or by activation for the one
// seat its mod acts for each time it shows or toggles it, one view a seat, which is put away for a seat again. A view
// holds the keyboard of every seat it is shown for by activation, of any number at once, from the time it is shown
// for the seat until it is put away for it. Views are named by their ids, seats by the tokens the caller keeps.
function createShowing() {
    // MARK: - Property
    const seats = new Map(); // seat -> the view shown for it by activation, or null
    const views = new Map(); // view -> whether it is shown for every seat

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
    // `seat`, the one its mod acts for, as show has it.
    function open(view, { activates = true, seat = null } = {}) {
        views.set(view, !activates);
        if (activates) show(view, seat);
    }

    // A view closes: it is on no screen.
    function close(view) {
        if (!views.delete(view)) return;
        for (const [seat, shown] of seats) if (shown === view) seats.set(seat, null);
    }

    // Shown for `seat`, the one its mod acts for, and for no seat where that is null: the view the seat had is put
    // away for it, one a seat, and the seat's keyboard is this view's. Every other seat's screen and keyboard are left
    // as they are.
    function show(view, seat) {
        if (!views.has(view) || !seats.has(seat)) return;
        seats.set(seat, view);
    }

    // For `seat`, the one its mod acts for: put away where it is shown for it by activation, shown where it is not.
    // Every other seat's screen is left as it is.
    function toggle(view, seat) {
        if (!views.has(view)) return;
        if (seats.get(seat) === view) putAway(seat);
        else show(view, seat);
    }

    // The view shown for `seat` by activation is put away for it, the seat's keyboard its no more: as a window becomes
    // the seat's key window, at Escape the view left unhandled, at Close Window, and as the seat begins to follow
    // another. Answers whether one was.
    function putAway(seat) {
        if ((seats.get(seat) ?? null) === null) return false;
        seats.set(seat, null);
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

    // The view shown for `seat` by activation, which holds its keyboard, or null.
    function of(seat) {
        return seats.get(seat) ?? null;
    }

    // The seats the view is shown for by activation, whose keyboard it holds, in the order they sat.
    function seatsOf(view) {
        return [...seats].filter(([, shown]) => shown === view).map(([seat]) => seat);
    }

    // Whether the view is on `seat`'s screen: shown for every seat, or for it.
    function isOn(seat, view) {
        return seats.has(seat) && (views.get(view) === true || seats.get(seat) === view);
    }

    // `views`, those on the screen of `seat` in the order they opened, as they lie there from the bottom: the one shown
    // for it by activation, which the seat asked for, over those shown for every seat.
    function stackedOn(seat, views) {
        const own = of(seat);
        return [...views.filter((view) => view !== own), ...views.filter((view) => view === own)];
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
        of,
        seatsOf,
        stackedOn,
        isOn,
        isShown,
    };
}

export { createShowing };
