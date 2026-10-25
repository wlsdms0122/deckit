const PARAMS = require('../command/params.js');

// MARK: - Property
// The shell's command that puts a mod on screen. Each mod it can show is an item of its own, "Show <mod>", in that
// mod's section, so the command is not listed as one.
const SHOW = Object.freeze({ mod: '@shell', command: 'show' });
// Whose a host's commands are: one section, the app's, for every host owner.
const APP = '@';

// MARK: - Initializer
// MARK: - Public
// What the list holds, before it is made runnable: `{ id, label, hint, icon, group, mod, keywords, tone, attention,
// fallback, reference, completes }`, `mod` the section it is in, `{ id, name, icon }`. An item runs `reference`,
// `{ mod, command, args }`, or opens a list to fill `completes`, a reference with the `param` to fill; one with
// neither is read only.

// Every command a person can fill the args of, each mod's listed rows, and a Show item for each mod the shell can
// show, mod by mod in the order the registry lists their owners, the app's first. `commands` is the registry's
// list, `rows` `[mod id, rows]` as `row.js` reads them, `shown` the completion of the shell's Show command, and
// `iconOf(mod)` the icon the shell lists a mod with. A row that runs a command of its mod with no args is that
// command's item, which it draws; any other row is found by the keywords of the command it runs too.
function listed({ commands, rows, shown, iconOf }) {
    const sections = new Map(); // section id -> { mod, items }
    const ownItems = new Map(); // `${mod}\0${command}` -> the item of a command run with no args
    const names = namesOf(commands, shown);
    const keywords = keywordsOf(commands);
    const sectionOf = (mod) => {
        if (!sections.has(mod)) sections.set(mod, { mod: ownerOf(mod, names, iconOf), items: [] });
        return sections.get(mod);
    };
    for (const entry of commands) {
        if (isShow(entry) || !PARAMS.fillable(entry.params)) continue;
        const section = sectionOf(entry.host ? APP : entry.mod);
        const item = commandItem(entry, section.mod);
        section.items.push(item);
        if (item.reference) ownItems.set(`${entry.mod}\u0000${entry.command}`, item);
    }
    for (const [mod, read] of rows)
        for (const row of read) {
            const own = row.reference && isBare(row.reference) && ownItems.get(`${mod}\u0000${row.reference.command}`);
            if (own)
                Object.assign(own, { label: row.label, hint: row.hint, icon: row.icon || own.icon, group: row.group });
            else sectionOf(mod).items.push(rowItem(row, sectionOf(mod).mod, keywords));
        }
    if (commands.some(isShow))
        for (const { value, title, keywords } of shown) {
            const section = sectionOf(String(value));
            section.items.unshift({
                ...blank(section.mod),
                id: idOf('show', value),
                label: `Show ${title}`,
                icon: section.mod.icon,
                keywords: keywords.join(' '),
                reference: { ...SHOW, args: { mod: value } },
            });
        }
    return [...sections.values()].flatMap(({ items }) => items);
}

// A row of the Now strip or one answered for a query, by `mod`, whose name and icon `names` and `iconOf` give, found by
// the `keywords` of the command it runs.
function answered(kind, mod, row, { names, iconOf, keywords }) {
    return {
        ...rowItem(row, ownerOf(mod, names, iconOf), keywords),
        id: idOf(kind, mod, row.label, row.reference || row.completes),
    };
}

// A value offered for the arg `completes.param`, `{ value, title, hint, keywords }`, as an item in the list that fills
// it: it runs the command once each arg it requires is filled, and else opens the list for the next.
function offered(parent, candidate, params) {
    const { mod, command, args, param } = parent.completes;
    const filled = { ...args, [param]: candidate.value };
    const left = PARAMS.next(params, filled);
    return {
        ...blank(parent.mod),
        id: idOf(parent.id, candidate.value),
        label: candidate.title,
        hint: candidate.hint,
        icon: parent.icon,
        keywords: candidate.keywords.join(' '),
        reference: left ? null : { mod, command, args: filled },
        completes: left ? { mod, command, args: filled, param: left } : null,
    };
}

// Whether a command the registry lists is the shell's Show.
function isShow({ mod, command }) {
    return mod === SHOW.mod && command === SHOW.command;
}

// Each owner's name, as the registry and the shell's Show completion give it.
function namesOf(commands, shown) {
    const names = new Map();
    for (const { mod, modName } of commands) names.set(mod, modName);
    for (const { value, title } of shown) names.set(String(value), title);
    return names;
}

// Each command's keywords, `${mod}\0${command}` -> its keywords as one text.
function keywordsOf(commands) {
    return new Map(commands.map(({ mod, command, keywords }) => [`${mod}\u0000${command}`, keywords.join(' ')]));
}

// MARK: - Private
function commandItem(entry, owner) {
    const { mod, command, params } = entry;
    const param = PARAMS.next(params, {});
    return {
        ...blank(owner),
        id: idOf('command', mod, command),
        label: entry.label,
        icon: owner.icon,
        keywords: entry.keywords.join(' '),
        reference: param ? null : { mod, command, args: {} },
        completes: param ? { mod, command, args: {}, param } : null,
    };
}

function rowItem(row, owner, keywords) {
    const runs = row.reference || row.completes;
    return {
        ...blank(owner),
        ...row,
        keywords: (runs && keywords.get(`${runs.mod}\u0000${runs.command}`)) || '',
        id: idOf('row', owner.id, row.label, row.reference || row.completes),
        icon: row.icon || owner.icon,
    };
}

function blank(owner) {
    return {
        label: '',
        hint: '',
        icon: '',
        group: '',
        mod: owner,
        keywords: '',
        tone: 'info',
        attention: false,
        fallback: false,
        reference: null,
        completes: null,
    };
}

// A host's commands are the app's, under the host's name.
function ownerOf(mod, names, iconOf) {
    if (mod === APP) return { id: APP, name: names.get('@app') || names.get('@shell') || '', icon: '' };
    return { id: mod, name: names.get(mod) || mod, icon: iconOf(mod) };
}

function isBare(reference) {
    return !Object.keys(reference.args).length;
}

function idOf(...parts) {
    return JSON.stringify(parts);
}

module.exports = { SHOW, listed, answered, offered, namesOf, keywordsOf, isShow };
