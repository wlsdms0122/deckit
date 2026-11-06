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

// Work that needed the mod, as the layer that asked for it describes it, and the id of the mod that asked for it, if
// any.
function work(described, mod = null) {
    return Object.freeze({ kind: 'work', work: described, ...(mod ? { mod } : {}) });
}

// MARK: - Private

export { PERSON, STARTUP, requiredBy, work };
