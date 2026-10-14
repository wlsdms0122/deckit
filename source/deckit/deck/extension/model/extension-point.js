// MARK: - Property
// A mod id holds no colon, so the first one ends it.
const SEPARATOR = ':';

// MARK: - Initializer
// MARK: - Public
// An extension point's id, as another mod names it: after the mod that opened it, `<mod id>:<name>`.
function idOf(modId, name) {
    return modId + SEPARATOR + name;
}

function isId(id) {
    const at = id.indexOf(SEPARATOR);
    return at > 0 && at < id.length - 1;
}

function modOf(id) {
    return id.slice(0, id.indexOf(SEPARATOR));
}

function nameOf(id) {
    return id.slice(id.indexOf(SEPARATOR) + 1);
}

// MARK: - Private

export { idOf, isId, modOf, nameOf };
