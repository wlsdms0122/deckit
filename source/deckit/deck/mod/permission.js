// The permissions deck checks itself, as a person reads them before installing. `reach`: `system`, past the app, or
// `app`, inside it.
const MODS = 'deckit.mods';
const MOD_SETTINGS = 'deckit.mod-settings';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MODS,
        name: 'Mods',
        icon: 'puzzle',
        means: 'It can see every installed mod, add one from a folder and delete installed ones, with what they stored.',
        reach: 'app',
    }),
    Object.freeze({
        id: MOD_SETTINGS,
        name: 'Mod Settings',
        icon: 'sliders',
        means: 'It can read and change the settings of every mod, not only its own.',
        reach: 'app',
    }),
]);
const REACHES = ['system', 'app'];

export function createPermission() {
    // MARK: - Property
    const defined = new Map(); // id -> { id, name, icon, means, reach }, in the order each was defined
    let read = false; // a manifest has been read against them

    // MARK: - Initializer
    // MARK: - Public
    // A permission a layer grants what it adds with: `name` and `means` are what a person reads before installing,
    // `icon` names the glyph it is shown with. Defined before any manifest is read: one read against the
    // permissions there were is not read again.
    function define({ id, name, icon = '', means, reach }) {
        if (read) throw new Error(`[deckit] ${id} is defined after manifests were read`);
        if (defined.has(id)) throw new Error(`[deckit] ${id} is defined`);
        if (!REACHES.includes(reach)) throw new Error(`[deckit] ${id} reaches ${reach}, not ${REACHES.join(' or ')}`);
        defined.set(id, Object.freeze({ id, name, icon, means, reach }));
    }

    // The widest first: those that reach past the app, then those inside it, each in the order defined.
    function all() {
        read = true;
        const permissions = [...defined.values()];
        return REACHES.flatMap((reach) => permissions.filter((permission) => permission.reach === reach));
    }

    // MARK: - Private

    return { MODS, MOD_SETTINGS, define, all };
}

export { MODS, MOD_SETTINGS, PERMISSIONS };
