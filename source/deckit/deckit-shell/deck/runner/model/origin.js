// MARK: - Property
// Why a run launches, as the core keeps it on the run and does not act on it: the person opened the mod, or it is in
// the startup list.
const PERSON = Object.freeze({ kind: 'person' });
const STARTUP = Object.freeze({ kind: 'startup' });

// MARK: - Initializer
// MARK: - Public
// A mod that requires it by id launched, by that mod's id.
function requiredBy(id) {
    return Object.freeze({ kind: 'required', by: id });
}

// MARK: - Private

export { PERSON, STARTUP, requiredBy };
