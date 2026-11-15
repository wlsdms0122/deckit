// MARK: - Property
// The status bar as plain data: the items mods give it, the order they stand in and where each is laid in the capsule.
// Sizes are constants here and a label's width is handed in, so every rect is known without asking a page.
// The capsule: its height, the inset around its row of items and the room between them.
const CAPSULE = Object.freeze({ height: 28, inset: 2, gap: 4 });
// An item: its height, the glyph it shows, the padding at each side and the room between its parts. A label holds
// `letters` characters at most and is laid as wide as it was measured, `widest` at most, `letter` a character until
// it is measured.
const ITEM = Object.freeze({ height: 24, glyph: 16, padding: 8, gap: 4, letters: 24, widest: 160, letter: 7 });
// A count: the most it writes as it is, and the width it adds, `digit` a character.
const COUNT = Object.freeze({ most: 99, digit: 7 });
// What an item is named by, a glyph and a command are: letters, digits, "_" and "-".
const WORD = /^[A-Za-z0-9_-]{1,64}$/;
const NAMED = 64;
const TONES = Object.freeze(['plain', 'attention']);
// What a mod declares of its item, and what one sets while it runs, the first three only where it declared none.
const DECLARED = Object.freeze(['name', 'icon', 'command']);
const SET = Object.freeze(['label', 'count', 'tone']);

const isName = (value) => typeof value === 'string' && value.trim() !== '' && value.length <= NAMED;
const isWord = (value) => typeof value === 'string' && WORD.test(value);

// MARK: - Initializer
// MARK: - Public
// The item a mod declares in its manifest, `{ name, icon, command }`, or null for an entry of another shape: `name`
// text of 1 to 64 characters, `icon` a glyph's name or left out, `command` the id of a command of the mod's or left
// out.
function declaredOf(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    if (Object.keys(entry).some((key) => !DECLARED.includes(key))) return null;
    const { name, icon = null, command = null } = entry;
    if (!isName(name) || (icon !== null && !isWord(icon)) || (command !== null && !isWord(command))) return null;
    return { name, icon, command };
}

// The item of a mod as it stands after `set(given)`, `{ name, icon, label, count, tone, command }`, or null for
// another shape. `declared` is what the mod declared (declaredOf), or null: with it `given` holds `label`, `count` and
// `tone` alone, without it `name`, `icon` and `command` too. `label` is text of ITEM.letters characters at most,
// `count` a whole number from 0 on or null, `tone` one of TONES; what is left out is none, and `plain`.
function heldTo(given, declared = null) {
    if (!given || typeof given !== 'object' || Array.isArray(given)) return null;
    const taken = declared ? SET : [...DECLARED, ...SET];
    if (Object.keys(given).some((key) => !taken.includes(key))) return null;
    const from =
        declared ??
        declaredOf(Object.fromEntries(DECLARED.flatMap((key) => (key in given ? [[key, given[key]]] : []))));
    if (!from) return null;
    const { label = '', count = null, tone = TONES[0] } = given;
    if (typeof label !== 'string' || label.length > ITEM.letters) return null;
    if (count !== null && !(Number.isInteger(count) && count >= 0)) return null;
    if (!TONES.includes(tone)) return null;
    return { ...from, label, count, tone };
}

// A declared item before its mod sets anything, and once it took back what it set.
function restOf(declared) {
    return heldTo({}, declared);
}

// The ids in the order they began to be there: `order` as it was, without those that went, then those that are new.
function orderOf(order, ids) {
    return [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
}

// What a count writes: the number, or the most with a plus beyond it.
function countText(count) {
    return count > COUNT.most ? `${COUNT.most}+` : String(count);
}

// What an item is called: its name, its count and whether it asks for attention.
function titleOf({ name, count, tone }) {
    return [name, ...(count === null ? [] : [countText(count)]), ...(tone === TONES[0] ? [] : [tone])].join(', ');
}

// What the bar is called: `name`, and how many items it does not show.
function nameOf(name, hidden) {
    return hidden ? `${name}, ${hidden} more` : name;
}

// Whether an item shows anything: one with no glyph, no label and no count is not laid.
function shows({ icon, label, count }) {
    return !!icon || !!label || count !== null;
}

// How wide an item is laid: a glyph alone is 32; a count adds its characters, a label its width in `widths`, a
// label's text to its measured width, ITEM.widest at most.
function widthOf({ icon, label, count }, widths = {}) {
    const parts = [
        ...(icon ? [ITEM.glyph] : []),
        ...(label ? [Math.min(Math.ceil(widths[label] ?? label.length * ITEM.letter), ITEM.widest)] : []),
        ...(count === null ? [] : [countText(count).length * COUNT.digit]),
    ];
    return 2 * ITEM.padding + parts.reduce((sum, each) => sum + each, 0) + (parts.length - 1) * ITEM.gap;
}

// The most the capsule is wide in `room`, `{ width }`, the room a band has in the host's bar: half of it. With no
// room told there is no limit.
function limitOf(room) {
    return room ? Math.floor(room.width / 2) : Infinity;
}

// `{ width, height, items: [{ id, rect }], hidden }`: the capsule's size, and each item's rect in it, of `items`,
// `[{ id, ...item }]` in the order they stand, the first rightmost: the fixed ones in the mods' order, then those that
// come and go in the order they came. Items are taken from the right while the capsule stays within `limit`; from the
// first that does not fit on none is laid, and `hidden` counts them. One that shows nothing is neither laid nor
// counted. With no item laid the width is 0: there is no capsule.
function barOf(items, widths = {}, limit = Infinity) {
    const standing = items.filter(shows);
    const sized = standing.map((item) => widthOf(item, widths));
    let width = 2 * CAPSULE.inset;
    let fit = 0;
    for (; fit < sized.length; fit++) {
        const next = width + sized[fit] + (fit ? CAPSULE.gap : 0);
        if (next > limit) break;
        width = next;
    }
    let right = width - CAPSULE.inset;
    const laid = standing.slice(0, fit).map(({ id }, at) => {
        const rect = { x: right - sized[at], y: CAPSULE.inset, width: sized[at], height: ITEM.height };
        right = rect.x - CAPSULE.gap;
        return { id, rect };
    });
    return { width: fit ? width : 0, height: CAPSULE.height, items: laid, hidden: standing.length - fit };
}

// MARK: - Private
module.exports = {
    CAPSULE,
    ITEM,
    TONES,
    declaredOf,
    heldTo,
    restOf,
    orderOf,
    countText,
    titleOf,
    nameOf,
    shows,
    widthOf,
    limitOf,
    barOf,
};
