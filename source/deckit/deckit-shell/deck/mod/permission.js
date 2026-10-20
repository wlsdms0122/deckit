// The permissions deck checks itself, as a person reads them before installing. `reach`: `system`, past the app, or
// `app`, inside it.
const MODS = 'deckit.mods';
const MOD_SETTINGS = 'deckit.mod-settings';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MODS,
        name: 'Mods',
        means: 'It can see every installed mod, add one from a folder and delete installed ones, with what they stored.',
        reach: 'app',
    }),
    Object.freeze({
        id: MOD_SETTINGS,
        name: 'Mod Settings',
        means: 'It can read and change the settings of every mod, not only its own.',
        reach: 'app',
    }),
]);

export function createPermission() {
    // MARK: - Property
    const defined = []; // { id, name, means, reach }, in the order each was defined
    let handed = false; // the core has them

    // MARK: - Initializer
    // MARK: - Public
    // A permission a layer guards what it adds with: `name` and `means` are what a person reads before installing,
    // and `reach` is `system`, past the app, or `app`, inside it. Defined before the core starts, which reads every
    // manifest against them.
    function define({ id, name, means, reach }) {
        if (handed) throw new Error(`[deckit] ${id} is defined after the core started`);
        defined.push(Object.freeze({ id, name, means, reach }));
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
