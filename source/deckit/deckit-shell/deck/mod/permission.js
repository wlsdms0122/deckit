// The permissions deck checks itself, as a person reads them before installing.
const MODS = 'deckit.mods';
const MOD_SETTINGS = 'deckit.mod-settings';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MODS,
        name: 'Mods',
        means: 'It can see every installed mod, add one from a folder, which gets every permission it asks for, and delete installed ones, with what they stored.',
    }),
    Object.freeze({
        id: MOD_SETTINGS,
        name: 'Mod Settings',
        means: 'It can read and change the settings of every mod, not only its own.',
    }),
]);

export function createPermission() {
    // MARK: - Property
    const defined = []; // { id, name, means }, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission a layer guards what it adds with: `name` and `means` are what a person reads before installing.
    // The id's prefix says how far it reaches: `system.` past the app, `deckit.` inside it. Defined before the core
    // starts, which reads every manifest against them.
    function define({ id, name, means }) {
        if (handed) throw new Error(`[deckit] ${id} is defined after the core started`);
        defined.push(Object.freeze({ id, name, means }));
    }

    // What the layers defined, for the core as it starts.
    function all() {
        handed = true;
        return [...defined];
    }

    // MARK: - Private

    return { define, all };
}

export { MODS, MOD_SETTINGS, PERMISSIONS };
