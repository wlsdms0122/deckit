// Deckit's own permission, which Deckit defines itself: what a mod holds to drive mods, checked here too.
const MODS = 'deckit.mods';
// A text that holds a code point without the property White_Space.
const NOT_BLANK = /\P{White_Space}/u;

// The permissions the layers on this host define, each guarding what its layer adds and checked there. The core
// reads every manifest against them beside its own, and one neither defines is not usable here.
export function createPermission() {
    // MARK: - Property
    const defined = []; // `{ id, name, description, privileged }`, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission of a layer on this host: `name` and `description` are what a person reads before installing, and a
    // `privileged` one is granted only to a system mod. Defined once, before the core starts. Refused of kind
    // PERMISSION; the core refuses one it defines itself, with the same kind.
    function define({ id, name, description, privileged = false }) {
        if (handed) throw refusal(`${id} is defined after the core started`);
        if (typeof id !== 'string') throw refusal("a permission's id is no text");
        for (const [key, value] of Object.entries({ name, description }))
            if (typeof value !== 'string' || !NOT_BLANK.test(value)) throw refusal(`a permission's ${key} is blank`);
        if (typeof privileged !== 'boolean') throw refusal(`${id} says privileged as no boolean`);
        if (defined.some((permission) => permission.id === id)) throw refusal(`${id} is defined twice`);
        defined.push({ id, name, description, privileged });
    }

    // What the core reads every manifest against, as it starts.
    function all() {
        handed = true;
        return { permissions: defined.map((permission) => ({ ...permission })) };
    }

    // MARK: - Private
    function refusal(message) {
        return Object.assign(new Error(`[deckit] ${message}`), { kind: 'PERMISSION' });
    }

    return { define, all };
}

export { MODS };
