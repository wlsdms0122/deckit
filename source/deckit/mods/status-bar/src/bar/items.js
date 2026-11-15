// The items of the status bar as they stand, whether a screen draws them or not: what mods declare to
// `status-bar/items`, what each running mod set, and the order the ones that come and go came in (model/bar.js). A
// fixed item is one a mod declares in its manifest; an item that comes and goes is set and removed by a running mod.
const BAR = require('./model/bar.js');

const INTERFACE = 'status-bar/items';
// The signals of the interface after which what is declared to it is read again.
const SIGNALS = ['contributions-changed', 'owner-changed'];

function items(deckit) {
    // MARK: - Property
    let declared = new Map(); // mod id -> what it declared, in the mods' order
    const set = new Map(); // mod id -> its item as it last set it
    let came = []; // the ids of the mods whose item comes and goes, in the order they came
    let draws = null; // whether the kit draws a glyph, while a screen stands to tell
    const undrawn = new Set(); // the glyphs told as not drawn
    const listeners = new Set();
    const offs = SIGNALS.map((signal) => deckit.events.on(`${INTERFACE}:${signal}`, read));

    // MARK: - Initializer
    const ready = read(); // what is declared, read once: a mod's `set` is held to it

    // MARK: - Public
    // The exports for a connection: `set(item)` gives the mod's item, or what changes of the one it declared, and
    // `remove()` takes it back. Another shape is refused, kind `INVALID_ARGUMENT`, as is a glyph the screen that
    // stands does not draw.
    function exportsFor(connection) {
        const id = connection.credential.mod;
        return Object.freeze({
            set: async (given) => {
                await ready;
                const held = BAR.heldTo(given, declared.get(id) ?? null);
                if (!held || !drawn(held.icon)) throw refusal(`${connection.mod.name} set an item of another shape`);
                set.set(id, held);
                changed();
            },
            remove: async () => leave(id),
        });
    }

    // A mod's item goes with its connection.
    function leave(id) {
        if (set.delete(id)) changed();
    }

    // The items in the order they stand: the fixed ones in the mods' order, then the others as they came. One whose
    // glyph the screen does not draw is left out.
    function standing() {
        came = BAR.orderOf(
            came,
            [...set.keys()].filter((id) => !declared.has(id))
        );
        const fixed = [...declared].map(([id, item]) => ({ id, ...(set.get(id) ?? BAR.restOf(item)) }));
        return [...fixed, ...came.map((id) => ({ id, ...set.get(id) }))].filter(({ id, icon }) => {
            if (drawn(icon)) return true;
            if (!undrawn.has(`${id} ${icon}`)) console.warn(`[status-bar] the glyph ${icon} of ${id} is not drawn`);
            undrawn.add(`${id} ${icon}`);
            return false;
        });
    }

    // `listener()` is called each time what stands may have changed, until its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // The screen that stands tells which glyphs it draws, `draws(icon)`, or null as it goes.
    function drawnBy(told) {
        draws = told;
    }

    function end() {
        for (const off of offs) off();
        listeners.clear();
    }

    // MARK: - Private
    // What mods declare, one item a mod, the first it declares: an entry of another shape is left out.
    async function read() {
        const next = new Map();
        for (const { credential, entry } of await deckit.exports.contributions(INTERFACE).catch(() => [])) {
            const held = BAR.declaredOf(entry);
            if (held && !next.has(credential.mod)) next.set(credential.mod, held);
            else console.warn(`[status-bar] an item ${credential.mod} declares is left out`);
        }
        // What a mod set stays over what it declares now; one that declares an item where it did not, or no more,
        // sets its item anew.
        for (const [id, { label, count, tone }] of set) {
            if (declared.has(id) !== next.has(id)) set.delete(id);
            else if (next.has(id)) set.set(id, BAR.heldTo({ label, count, tone }, next.get(id)));
        }
        declared = next;
        changed();
    }

    function drawn(icon) {
        return icon === null || !draws || draws(icon);
    }

    function changed() {
        for (const listener of [...listeners]) listener();
    }

    function refusal(message) {
        return Object.assign(new Error(message), { kind: 'INVALID_ARGUMENT' });
    }

    return Object.freeze({ exportsFor, leave, standing, onChange, drawnBy, end });
}

module.exports = { items, INTERFACE };
