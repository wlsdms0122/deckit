// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The ids in the list's order: those `order` places, as it places them, then the rest as `ids` has them.
function sorted(ids, order) {
    const rank = (id) => {
        const place = order.indexOf(id);
        return place < 0 ? order.length : place;
    };
    return ids
        .map((id, at) => ({ id, at }))
        .sort((one, other) => rank(one.id) - rank(other.id) || one.at - other.at)
        .map(({ id }) => id);
}

// The ids that `moved` names take the places they held among themselves, in the order it names them; the rest stay
// put. An id `ids` does not have is left out.
function arranged(ids, moved) {
    const named = [...new Set(moved)].filter((id) => ids.includes(id));
    const places = ids.flatMap((id, place) => (named.includes(id) ? [place] : []));
    const next = [...ids];
    places.forEach((place, at) => (next[place] = named[at]));
    return next;
}

// MARK: - Private

export { sorted, arranged };
