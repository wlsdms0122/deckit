const PARAMS = require('../command/params.js');

// MARK: - Property
// The shell's command that puts a mod on screen. Each mod it can show is an item of its own, "Show <mod>", in that
// mod's section, so the command is not listed as one.
const SHOW = Object.freeze({ provider: '@shell', command: 'show' });
// The section of a host's commands: one, the app's, for every host.
const APP = '@';

// MARK: - Initializer
// MARK: - Public
// What the list holds, before it is made runnable: `{ id, label, hint, icon, group, section, keywords, tone,
// attention, fallback, reference, completes }`, `section` the one it is in, `{ id, name, icon }`. An item runs
// `reference`, `{ provider, command, args }`, or opens a list to fill `completes`, a reference with the `param` to
// fill; one with neither is read only.

// Every command a person can fill the args of, each mod's listed rows, and a Show item for each mod the shell can
// show, provider by provider in the order the registry lists them, the app's first. `commands` is the registry's
// list, `rows` `[mod id, rows]` as `row.js` reads them, `shown` the completion of the shell's Show command, and
// `about` what a section is drawn with (`sectionOf` below). A row that runs a command of its mod with no args is that
// command's item, which it draws; any other row is found by the keywords of the command it runs too.
function listed({ commands, rows, shown, about }) {
    const sections = new Map(); // section id -> { section, items }
    const ownItems = new Map(); // `${provider}\0${command}` -> the item of a command run with no args
    const keywords = keywordsOf(commands);
    const placeOf = (id) => {
        const section = sectionOf(id, about);
        if (!sections.has(section.id)) sections.set(section.id, { section, items: [] });
        return sections.get(section.id);
    };
    for (const entry of commands) {
        if (isShow(entry) || !PARAMS.fillable(entry.params)) continue;
        const place = placeOf(entry.provider);
        const item = commandItem(entry, place.section);
        place.items.push(item);
        if (item.reference) ownItems.set(`${entry.provider}\u0000${entry.command}`, item);
    }
    for (const [mod, read] of rows)
        for (const row of read) {
            const own = row.reference && isBare(row.reference) && ownItems.get(`${mod}\u0000${row.reference.command}`);
            if (own)
                Object.assign(own, { label: row.label, hint: row.hint, icon: row.icon || own.icon, group: row.group });
            else placeOf(mod).items.push(rowItem(row, placeOf(mod).section, keywords));
        }
    if (commands.some(isShow))
        for (const { value, title, keywords } of shown) {
            const place = placeOf(String(value));
            place.items.unshift({
                ...blank(place.section),
                id: idOf('show', value),
                label: `Show ${title}`,
                icon: place.section.icon,
                keywords: keywords.join(' '),
                reference: { ...SHOW, args: { mod: value } },
            });
        }
    return [...sections.values()].flatMap(({ items }) => items);
}

// A row of the Now strip or one answered for a query, by `mod`, in its section as `about` draws it, found by the
// `keywords` of the command it runs.
function answered(kind, mod, row, { about, keywords }) {
    return {
        ...rowItem(row, sectionOf(mod, about), keywords),
        id: idOf(kind, mod, row.label, row.reference || row.completes),
    };
}

// A value offered for the arg `completes.param`, `{ value, title, hint, keywords }`, as an item in the list that fills
// it: it runs the command once each arg it requires is filled, and else opens the list for the next.
function offered(parent, candidate, params) {
    const { provider, command, args, param } = parent.completes;
    const filled = { ...args, [param]: candidate.value };
    const left = PARAMS.next(params, filled);
    return {
        ...blank(parent.section),
        id: idOf(parent.id, candidate.value),
        label: candidate.title,
        hint: candidate.hint,
        icon: parent.icon,
        keywords: candidate.keywords.join(' '),
        reference: left ? null : { provider, command, args: filled },
        completes: left ? { provider, command, args: filled, param: left } : null,
    };
}

// Whether a command the registry lists is the shell's Show.
function isShow({ provider, command }) {
    return provider === SHOW.provider && command === SHOW.command;
}

// The providers a section may be drawn for: those of `commands`, the mods of `rows` and those `shown`.
function providersIn({ commands, rows, shown }) {
    return [
        ...new Set([
            ...commands.map(({ provider }) => provider),
            ...rows.map(([mod]) => mod),
            ...shown.map(({ value }) => String(value)),
        ]),
    ];
}

// Each command's keywords, `${provider}\0${command}` -> its keywords as one text.
function keywordsOf(commands) {
    return new Map(
        commands.map(({ provider, command, keywords }) => [`${provider}\u0000${command}`, keywords.join(' ')])
    );
}

// MARK: - Private
function commandItem(entry, section) {
    const { provider, command, params } = entry;
    const param = PARAMS.next(params, {});
    return {
        ...blank(section),
        id: idOf('command', provider, command),
        label: entry.label,
        icon: section.icon,
        keywords: entry.keywords.join(' '),
        reference: param ? null : { provider, command, args: {} },
        completes: param ? { provider, command, args: {}, param } : null,
    };
}

function rowItem(row, section, keywords) {
    const runs = row.reference || row.completes;
    return {
        ...blank(section),
        ...row,
        keywords: (runs && keywords.get(`${runs.provider}\u0000${runs.command}`)) || '',
        id: idOf('row', section.id, row.label, row.reference || row.completes),
        icon: row.icon || section.icon,
    };
}

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
        reference: null,
        completes: null,
    };
}

// The section of provider `id`, `{ id, name, icon }`: a host's commands are the app's, under the host's name. `about`
// is `{ providers, iconOf }`: `providers` the registry's `{ id, name, host }` by id, and `iconOf(mod)` the icon the
// shell lists a mod with.
function sectionOf(id, { providers, iconOf }) {
    const provider = providers.get(id) || { id, name: id, host: false };
    if (provider.host) return { id: APP, name: provider.name, icon: '' };
    return { id, name: provider.name, icon: iconOf(id) };
}

function isBare(reference) {
    return !Object.keys(reference.args).length;
}

function idOf(...parts) {
    return JSON.stringify(parts);
}

module.exports = { SHOW, listed, answered, offered, providersIn, keywordsOf, isShow };
