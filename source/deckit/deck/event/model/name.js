// MARK: - Property
// A mod id holds no colon, so the first one ends it.
const SEPARATOR = ':';

// MARK: - Initializer
// MARK: - Public
// How an event is named for whoever listens: after the mod that sent it, `<mod id>:<event name>`.
function nameOf(modId, name) {
    return modId + SEPARATOR + name;
}

function isNamed(name) {
    return name.includes(SEPARATOR);
}

// MARK: - Private

export { nameOf, isNamed };
