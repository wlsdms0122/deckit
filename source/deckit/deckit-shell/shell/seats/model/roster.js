// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What a mod is told of the seats, as plain data. Each seat is told under an id made here, a count as text, which says
// nothing of the seat or the user it names: no id tells the machine's seat from another, and one that left and sits
// again is told under a new one.
function createRoster() {
    const seatIds = new Map(); // a seat's id in the shell -> the id it is told under
    let made = 0; // how many ids were made

    // `{ seats }` as a mod is told them, of `now`, the same of the shell's: each `{ id, name, colour, idle, following }`
    // in the order they sat. A seat no longer in it loses its id. An id is made as its seat is first in `now`, so the
    // caller hands every change here for the ids to follow what happened and not who read.
    function told(now) {
        keep(seatIds, now.seats);
        return {
            seats: now.seats.map(({ id, name, colour, idle, following }) => ({
                id: seatIds.get(id),
                name,
                colour,
                idle: !!idle,
                following: !!following,
            })),
        };
    }

    // The shell's id of the seat told under `id`, or null for none that is told now.
    function seatOf(id) {
        return found(seatIds, id);
    }

    // MARK: - Private
    function keep(ids, items) {
        const standing = new Set(items.map(({ id }) => id));
        for (const id of [...ids.keys()]) if (!standing.has(id)) ids.delete(id);
        for (const { id } of items) if (!ids.has(id)) ids.set(id, String(++made));
    }

    function found(ids, told) {
        for (const [id, each] of ids) if (each === told) return id;
        return null;
    }

    return Object.freeze({ told, seatOf });
}

// MARK: - Private

export { createRoster };
