// The permissions deck checks itself, as a person reads them before installing.
const MODS = 'deckit.mods';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MODS,
        name: 'Mods',
        means: 'It can see every installed mod, add one from a folder, which gets every permission it asks for, and delete installed ones, with what they stored.',
    }),
]);

// The permissions the layers on this host define, each guarding what its layer adds and checked there. Deck knows
// none of them: it reads every manifest against them, and one no layer defines is not usable here.
export function createPermission() {
    // MARK: - Property
    const defined = []; // `{ id, name, means }`, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission of a layer on this host: `name` and `means` are what a person reads before installing. Defined
    // once, before the core starts.
    function define({ id, name, means }) {
        if (handed) throw new Error(`[deckit] ${id} is defined after the core started`);
        for (const [key, value] of Object.entries({ id, name, means }))
            if (typeof value !== 'string' || !value.trim())
                throw new Error(`[deckit] a permission's ${key} is no text`);
        if (defined.some((permission) => permission.id === id)) throw new Error(`[deckit] ${id} is defined twice`);
        defined.push({ id, name, means });
    }

    // What the core reads every manifest against, as it starts.
    function all() {
        handed = true;
        return { permissions: defined.map((permission) => ({ ...permission })) };
    }

    // MARK: - Private

    return { define, all };
}

export { MODS, PERMISSIONS };
