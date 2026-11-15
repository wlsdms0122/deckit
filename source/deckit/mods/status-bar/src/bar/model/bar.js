// MARK: - Property
// The status bar as plain data: the items mods give it, the order they came in, which of them are fixed and how the
// person fixes one, and where each is laid in the capsule's two regions, the fixed one at its right end and the one
// that scrolls sideways left of it. Sizes are constants here and a label's width is handed in, so every rect is known without asking a page.
// The capsule: its height, the inset around its regions, and the room between items and between the regions.
const CAPSULE = Object.freeze({ height: 28, inset: 2, gap: 4 });
// The items that are fixed until the person names others: the ids of their mods, the first rightmost.
const FIXED = Object.freeze(['clock', 'notifications']);
// What the one entry of an item's menu says: on an item that is not fixed, and on one that is.
const KEEP = Object.freeze({ on: 'Keep in Bar', off: "Don't Keep in Bar" });
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

// The order kept once the items of `ids` stand: `order` as it was, whole, then those that are new to it. An id whose
// item went stays where it was, so an item that comes back takes its old place.
function orderOf(order, ids) {
    return [...order, ...ids.filter((id, at) => !order.includes(id) && ids.indexOf(id) === at)];
}

// What a count writes: the number, or the most with a plus beyond it.
function countText(count) {
    return count > COUNT.most ? `${COUNT.most}+` : String(count);
}

// What an item is called: its name, what its label says, its count and whether it asks for attention.
function titleOf({ name, label = '', count, tone }) {
    const said = [name, label, count === null ? '' : countText(count), tone === TONES[0] ? '' : tone];
    return said.filter(Boolean).join(', ');
}

// What the button of an item shows, as plain data: `{ title, tone, pressable, icon, label, count }`, `title` what it
// is called, `pressable` whether a press runs anything, `icon` its glyph or null, `count` as it is written, '' for
// none. A frame keeps the button while its item stands and writes only the fields that differ from what it drew.
function faceOf(item) {
    const { tone, command, icon, label, count } = item;
    const written = count === null ? '' : countText(count);
    return { title: titleOf(item), tone, pressable: command !== null, icon, label, count: written };
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

// The capsule laid: `{ width, height, scroll, most, fixed, scrolled, items }`, of `items`, `[{ id, ...item }]` in the
// order they came. Those whose id is in `fixed`, a list of ids, stand in the fixed region at the capsule's right end in
// that list's order, the first rightmost, and never scroll. The others stand left of it in the order they came, the
// first rightmost, in a strip `extent` wide that scrolls sideways under the scrolled region, `scroll` px of its left
// end past the region's, held from 0 to `most`. The capsule is as wide as its items, and no wider than `room`,
// `{ width }`, the room it has, where one is told; the fixed region is never narrower than its items, so a room that
// holds no more leaves the scrolled region none. `fixed` and `scrolled` are the regions' rects in the capsule, or null
// for one that holds nothing, `scrolled` with `extent`. Each of `items` is `{ id, region, at, rect }`: `at` where it
// is drawn in its region, in the strip for one that scrolls, and `rect` the part of it in view, in the capsule, or
// null for one scrolled out. One that shows nothing is not laid. With no item laid the width is 0: there is no capsule.
function barOf(items, { widths = {}, fixed = [], room = null, scroll = 0 } = {}) {
    const standing = items.filter(shows);
    const held = fixed.flatMap((id) => standing.filter((item) => item.id === id));
    const loose = standing.filter(({ id }) => !fixed.includes(id));
    const [across, extent] = [held, loose].map((row) => spanOf(row, widths));
    const between = held.length && loose.length ? CAPSULE.gap : 0;
    const least = 2 * CAPSULE.inset + across;
    const whole = least + between + extent;
    const width = standing.length ? Math.max(least, Math.min(whole, room?.width ?? Infinity)) : 0;
    const view = Math.max(0, width - least - between);
    const most = Math.max(0, extent - view);
    const at = Math.min(Math.max(0, scroll), most);
    const region = (x, across) => ({ x, y: CAPSULE.inset, width: across, height: ITEM.height });
    const regions = {
        fixed: held.length ? region(width - CAPSULE.inset - across, across) : null,
        scrolled: loose.length && view ? { ...region(CAPSULE.inset, view), extent } : null,
    };
    const laid = [
        ...rowOf(held, widths, across).map((item) => {
            const { x, y } = regions.fixed;
            return { ...item, region: 'fixed', rect: { ...item.at, x: x + item.at.x, y } };
        }),
        ...rowOf(loose, widths, extent).map((item) => {
            const left = Math.max(0, item.at.x - at);
            const shown = Math.min(view, item.at.x + item.at.width - at) - left;
            const rect = shown > 0 ? { ...item.at, x: CAPSULE.inset + left, y: CAPSULE.inset, width: shown } : null;
            return { ...item, region: 'scrolled', rect };
        }),
    ];
    return { width, height: CAPSULE.height, scroll: at, most, ...regions, items: laid };
}

// How far the bar `bar` (barOf) is scrolled once the item `id` is in view whole: as it is where it is already, else
// the least from there. An item wider than the scrolled region shows from its left end.
function scrollTo(bar, id) {
    const item = bar.items.find((each) => each.id === id && each.region === 'scrolled');
    if (!item || !bar.scrolled) return bar.scroll;
    const { x, width } = item.at;
    return Math.min(x, Math.max(bar.scroll, x + width - bar.scrolled.width));
}

// How far a turn of the wheel `{ dx, dy }` scrolls the bar: by its sideways part, or by the vertical one where that
// is the larger.
function turnOf({ dx, dy }) {
    return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
}

// The list of fixed ids once the item `id` is fixed, `on`, or not: one fixed comes last, the leftmost of the fixed
// region, one that is fixed no more leaves, and the others keep their order, an id whose item does not stand now with
// them.
function fixedBy(list, id, on) {
    if (on) return list.includes(id) ? [...list] : [...list, id];
    return list.filter((each) => each !== id);
}

// The menu a context press at `point`, `{ x, y }` in the capsule, opens on the bar `bar` (barOf), or null where no
// item is in view there: `{ id, label, on, point }`, one entry on the item `id`, `on` what choosing it makes of the
// item, fixed where it is not in `list`, the fixed ids, and fixed no more where it is, and `point` where the menu
// opens, under the capsule at the left end of what shows of the item.
function menuOf(bar, list, { x, y }) {
    const holds = ({ rect }) =>
        rect && x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    const item = bar.items.find(holds);
    if (!item) return null;
    const on = !list.includes(item.id);
    const point = { x: item.rect.x, y: bar.height + CAPSULE.gap };
    return { id: item.id, label: on ? KEEP.on : KEEP.off, on, point };
}

// MARK: - Private
// How wide a row of items is, CAPSULE.gap apart.
function spanOf(row, widths) {
    return row.reduce((sum, item) => sum + widthOf(item, widths), 0) + Math.max(0, row.length - 1) * CAPSULE.gap;
}

// Where each item of a row `across` wide is drawn in it, `{ id, at }`: from the right, the first rightmost.
function rowOf(row, widths, across) {
    let right = across;
    return row.map((item) => {
        const width = widthOf(item, widths);
        const at = { x: right - width, y: 0, width, height: ITEM.height };
        right = at.x - CAPSULE.gap;
        return { id: item.id, at };
    });
}

module.exports = {
    CAPSULE,
    ITEM,
    FIXED,
    TONES,
    declaredOf,
    heldTo,
    restOf,
    orderOf,
    countText,
    titleOf,
    faceOf,
    shows,
    widthOf,
    barOf,
    scrollTo,
    turnOf,
    fixedBy,
    menuOf,
};
