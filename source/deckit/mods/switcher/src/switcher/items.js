// MARK: - Property
// The shell's command that puts a mod on screen. Each mod it can show is an item of its own, "Show <mod>", first in
// that mod's section.
const SHOW = Object.freeze({ provider: '@shell', command: 'show' });

// MARK: - Initializer
// MARK: - Public
// What the list holds, before it is made runnable: `{ id, label, hint, icon, group, section, keywords, tone,
// attention, fallback, key, mod, value, opens, shows }`, `section` the one it is in, `{ id, name, icon }`. An item
// gives `value` to the `run` of `mod`, the mod whose action it is, or with `opens` searches inside it; a Show item
// `shows` a mod; one with neither is read only.

// A Show item for each mod the shell can show, and each mod's listed actions, section by section: the mods in the
// order the shell shows them, then the others. `actions` is `[mod id, actions]` as `action.js` reads them, `shown` the
// completion of the shell's Show command, and `about` what a section is drawn with (`sectionOf` below).
function listed({ actions, shown, about }) {
    const sections = new Map(); // mod id -> its items
    for (const { value } of shown) sections.set(String(value), []);
    for (const [mod] of actions) if (!sections.has(mod)) sections.set(mod, []);
    for (const { value, title, keywords } of shown) {
        const section = sectionOf(String(value), about);
        sections.get(section.id).push({
            ...blank(section),
            id: idOf('show', value),
            label: `Show ${title}`,
            icon: section.icon,
            keywords: keywords.join(' '),
            shows: String(value),
        });
    }
    for (const [mod, read] of actions)
        for (const action of read) sections.get(mod).push(itemOf('listed', mod, action, about));
    return [...sections.values()].flat();
}

// An action of `mod` as an item in its section as `about` draws it: listed, of the Now strip, or answered under
// `kind`, the query or the submenu it answers.
function itemOf(kind, mod, action, about) {
    const section = sectionOf(mod, about);
    return {
        ...blank(section),
        ...action,
        id: idOf(kind, mod, action.label, action.value),
        icon: action.icon || section.icon,
        keywords: action.keywords.join(' '),
        mod,
    };
}

// The mods a section may be drawn for: those with `actions` and those `shown`.
function modsIn({ actions, shown }) {
    return [...new Set([...actions.map(([mod]) => mod), ...shown.map(({ value }) => String(value))])];
}

// MARK: - Private
function blank(section) {
    return {
        label: '',
        hint: '',
        icon: '',
        group: '',
        section,
        keywords: '',
        tone: 'info',
        attention: false,
        fallback: false,
        key: '',
        mod: '',
        value: null,
        opens: false,
        shows: '',
    };
}

// The section of mod `id`, `{ id, name, icon }`. `about` is `{ names, iconOf }`: `names` each mod's name by id, and
// `iconOf(mod)` the icon the shell lists a mod with.
function sectionOf(id, { names, iconOf }) {
    return { id, name: names.get(id) || id, icon: iconOf(id) };
}

function idOf(...parts) {
    return JSON.stringify(parts);
}

module.exports = { SHOW, listed, itemOf, modsIn };
