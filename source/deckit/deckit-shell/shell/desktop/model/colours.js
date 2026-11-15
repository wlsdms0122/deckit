// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// Which colour each seat is told apart by, of `names`, the colours in the order they are taken. A seat takes the
// first colour the fewest seats have, a free one while there is any, and gives it back as it leaves.
function createColours(names) {
    const taken = new Map(); // seat id -> its colour's name

    function take(seat) {
        if (taken.has(seat)) return taken.get(seat);
        const held = [...taken.values()];
        const count = (name) => held.filter((each) => each === name).length;
        const least = Math.min(...names.map(count));
        taken.set(
            seat,
            names.find((name) => count(name) === least)
        );
        return taken.get(seat);
    }

    function give(seat) {
        taken.delete(seat);
    }

    // The name of the colour `seat` has, or null.
    function of(seat) {
        return taken.get(seat) ?? null;
    }

    return Object.freeze({ take, give, of });
}

// MARK: - Private

export { createColours };
