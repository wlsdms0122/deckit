// The permissions deck checks itself, as a person reads them before installing.
const MODS = 'deckit.mods';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MODS,
        name: 'Mods',
        means: 'It can see every installed mod, add one from a folder, which gets every permission it asks for, and delete installed ones, with what they stored.',
    }),
]);

// `vocabulary` is every permission the mod contract names, `{ id, name, means }`, as a person reads them before
// installing.
export function createPermission({ vocabulary }) {
    // MARK: - Property
    const given = []; // the ids the layers on this host defined, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission of the contract a layer on this host gives, guarding what it adds. Defined before the core starts,
    // which reads every manifest against them: one the contract names that no layer gives is not usable here.
    function define({ id }) {
        if (handed) throw new Error(`[deckit] ${id} is defined after the core started`);
        if (!vocabulary.some((permission) => permission.id === id))
            throw new Error(`[deckit] ${id} is no permission the mod contract names`);
        given.push(id);
    }

    // What the core reads every manifest against, as it starts: the contract's permissions, and the ids of those this
    // host gives.
    function all() {
        handed = true;
        return { permissions: vocabulary.map((permission) => ({ ...permission })), given: [...given] };
    }

    // MARK: - Private

    return { define, all };
}

export { MODS, PERMISSIONS };
