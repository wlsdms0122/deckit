// MARK: - Property
// Each mod the shell can show is an item of its own, "Show <mod>", first in that mod's section, which the shell puts
// on screen. What was picked before keeps a Show item under this, which is no mod's id.
const SHOWN_BY = '@shell';

// MARK: - Initializer
// MARK: - Public
// What the list holds, before it is made runnable: `{ id, label, hint, icon, group, section, keywords, tone,
// attention, fallback, mod, value, opens, command, args, shows }`, `section` the one it is in, `{ id, name, icon }`. An
// item gives `value` to the `run` of `mod`, the mod whose action it is, or with `opens` searches inside it; one `mod`
// declared runs its `command` with `args`; a Show item `shows` a mod; one with none of these is read only.

// A Show item for each mod the shell can show, and each mod's listed actions, section by section: the mods in the
// order the shell shows them, then the others. `actions` is `[mod id, actions]` as `action.js` reads them, `shown` the
// mods the shell can show, `[{ id, name, keywords }]` as `shell.mods.list()` answers them, and `about` what a section
// is drawn with (`sectionOf` below).
function listed({ actions, shown, about }) {
    const sections = new Map(); // mod id -> its items
    for (const { id } of shown) sections.set(id, []);
    for (const [mod] of actions) if (!sections.has(mod)) sections.set(mod, []);
    for (const { id, name, keywords } of shown) {
        const section = sectionOf(id, about);
        sections.get(section.id).push({
            ...blank(section),
            id: idOf('show', id),
            label: `Show ${name}`,
            icon: section.icon,
            keywords: keywords.join(' '),
            shows: id,
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
        id: idOf(kind, mod, action.label, action.value, action.command ?? '', action.args ?? null),
        icon: action.icon || section.icon,
        keywords: action.keywords.join(' '),
        mod,
    };
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
        mod: '',
        value: null,
        opens: false,
        command: '',
        args: null,
        shows: '',
    };
}

// The section of mod `id`, `{ id, name, icon }`. `about` is `{ names, iconOf }`: `names` each mod's name by id, and
// `iconOf(mod)` the icon its manifest fields give it, or ''.
function sectionOf(id, { names, iconOf }) {
    return { id, name: names.get(id) || id, icon: iconOf(id) };
}

function idOf(...parts) {
    return JSON.stringify(parts);
}

module.exports = { SHOWN_BY, listed, itemOf };
