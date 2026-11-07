// Deckit's own permission, which Deckit defines itself: what a mod holds to drive mods, checked here too.
const MODS = 'deckit.mods';

// The permissions the layers on this host define, each guarding what its layer adds and checked there. The core
// reads every manifest against them beside its own, and one neither defines is not usable here.
export function createPermission() {
    // MARK: - Property
    const defined = []; // `{ id, name, means, privileged }`, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission of a layer on this host: `name` and `means` are what a person reads before installing, and a
    // `privileged` one is granted only to a system mod. Defined once, before the core starts.
    function define({ id, name, means, privileged = false }) {
        if (handed) throw new Error(`[deckit] ${id} is defined after the core started`);
        for (const [key, value] of Object.entries({ id, name, means }))
            if (typeof value !== 'string' || !value.trim())
                throw new Error(`[deckit] a permission's ${key} is no text`);
        if (typeof privileged !== 'boolean') throw new Error(`[deckit] ${id} says privileged as no boolean`);
        if (defined.some((permission) => permission.id === id)) throw new Error(`[deckit] ${id} is defined twice`);
        defined.push({ id, name, means, privileged });
    }

    // What the core reads every manifest against, as it starts.
    function all() {
        handed = true;
        return { permissions: defined.map((permission) => ({ ...permission })) };
    }

    // MARK: - Private

    return { define, all };
}

export { MODS };
