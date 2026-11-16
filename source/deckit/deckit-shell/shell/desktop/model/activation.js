// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// Which mods may activate for each seat, bringing their windows in front of its key window and taking its keyboard, and
// which ask for its attention. A seat's active mod may, and so may each mod the seat handed activation to since its
// last input: the mod its input reached, and each mod one that may asks of. What a mod does by activation it does for
// one seat, its cause: of the seats it may activate for, the one whose input reached it last, the inputs counted in
// the order they arrive here. A mod held back from activating asks for the seat's attention until it is the seat's
// active mod or has no window open. Mods are named by their ids, seats by the tokens the caller keeps.
function createActivation() {
    // MARK: - Property
    const seats = new Map(); // seat -> { active, handed, reached, attention }, `active` its active mod or null
    let arrived = 0; // how many inputs arrived: the order of the last one

    // MARK: - Public
    function addSeat(seat) {
        if (seats.has(seat)) return;
        seats.set(seat, { active: null, handed: new Set(), reached: new Map(), attention: new Set() });
    }

    function removeSeat(seat) {
        seats.delete(seat);
    }

    // The mod of the window that has the seat's keyboard, or null: it no longer asks for that seat's attention.
    function setActive(seat, mod) {
        const held = seats.get(seat);
        if (!held) return;
        held.active = mod;
        held.attention.delete(mod);
    }

    // The seat's input reached `mod`, or no mod (null): what it handed before is over, and that mod alone is handed it.
    function input(seat, mod) {
        const held = seats.get(seat);
        if (!held) return;
        held.handed = new Set(mod === null ? [] : [mod]);
        arrived += 1;
        if (mod !== null) held.reached.set(mod, arrived);
    }

    // `from` asks `to`: `to` may activate for each seat `from` may activate for, reached by the input of that seat that
    // reached `from`.
    function request(from, to) {
        for (const [seat, held] of seats) {
            if (!mayActivate(seat, from)) continue;
            held.handed.add(to);
            held.reached.set(to, Math.max(orderOf(held, to), orderOf(held, from)));
        }
    }

    // The seat `mod` acts for as it activates: of the seats it may activate for, the one whose input reached it last,
    // the one that sat first of those none reached it; or null where it may activate for none.
    function causeOf(mod) {
        let cause = null;
        for (const [seat, held] of seats) {
            if (!mayActivate(seat, mod)) continue;
            if (cause === null || orderOf(held, mod) > orderOf(seats.get(cause), mod)) cause = seat;
        }
        return cause;
    }

    // The seat's active mod, or null.
    function activeOf(seat) {
        return seats.get(seat)?.active ?? null;
    }

    function mayActivate(seat, mod) {
        const held = seats.get(seat);
        return !!held && mod !== null && (held.active === mod || held.handed.has(mod));
    }

    // `mod` was held back from activating for the seat.
    function requestAttention(seat, mod) {
        seats.get(seat)?.attention.add(mod);
    }

    // `mod` has no window open: it asks no seat's attention.
    function cancelAttention(mod) {
        for (const held of seats.values()) held.attention.delete(mod);
    }

    // The mods that ask for the seat's attention, in the order they first asked.
    function attentionOf(seat) {
        return [...(seats.get(seat)?.attention ?? [])];
    }

    // MARK: - Private
    // The order of the seat's last input that reached `mod`, itself or handed on; 0 where none did.
    function orderOf(held, mod) {
        return held.reached.get(mod) ?? 0;
    }

    return {
        addSeat,
        removeSeat,
        setActive,
        input,
        request,
        activeOf,
        mayActivate,
        causeOf,
        requestAttention,
        cancelAttention,
        attentionOf,
    };
}

export { createActivation };
