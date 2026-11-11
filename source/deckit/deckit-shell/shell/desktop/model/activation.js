// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// Which mods may activate for each seat, bringing their windows in front of its key window and taking its keyboard, and
// which ask for its attention. A seat's active mod may, and so may each mod the seat handed activation to since its
// last input: the mod its input reached, and each mod one that may asks of. A mod held back from activating asks for
// the seat's attention until it is the seat's active mod or has no window open. Mods are named by their ids, seats by
// the tokens the caller keeps.
function createActivation() {
    // MARK: - Property
    const seats = new Map(); // seat -> { active, handed, attention }, `active` its active mod or null

    // MARK: - Public
    function addSeat(seat) {
        if (!seats.has(seat)) seats.set(seat, { active: null, handed: new Set(), attention: new Set() });
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
    }

    // `from` asks `to`: `to` may activate for each seat `from` may activate for.
    function request(from, to) {
        for (const [seat, held] of seats) if (mayActivate(seat, from)) held.handed.add(to);
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

    return {
        addSeat,
        removeSeat,
        setActive,
        input,
        request,
        activeOf,
        mayActivate,
        requestAttention,
        cancelAttention,
        attentionOf,
    };
}

export { createActivation };
