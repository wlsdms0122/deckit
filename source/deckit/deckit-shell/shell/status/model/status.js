// MARK: - Property
// The status bar, a tray at the right end of the host's bar: a capsule of items, and under an item the popover of its
// rows. Plain data in and out: sizes are constants here, so every rect is known without asking a page.
// The capsule: its height, the inset around its row of items, the room between them, and how far in from the bar's
// right end it stands.
const CAPSULE = Object.freeze({ height: 28, inset: 2, gap: 4, margin: 8 });
// An item: its height, the glyph it shows, the padding at each side and the room between its parts. A label is laid
// as wide as it was measured, `widest` at most, and `letter` a character until it is measured.
const ITEM = Object.freeze({ height: 24, glyph: 16, padding: 8, gap: 4, widest: 240, letter: 7 });
// A count: the most it writes as it is, and the width it adds, `digit` a character.
const COUNT = Object.freeze({ most: 99, digit: 7 });
// The popover: its width, how far it stays inside the stage and under the bar, the height of a row, of the band of
// a row's actions and of the header of the item's own, the width of an action, how many are laid, the close button's
// side, the inset of what stands at a band's right end, and its corners.
const POPOVER = Object.freeze({
    width: 320,
    margin: 8,
    row: 44,
    band: 32,
    header: 32,
    action: 72,
    actions: 3,
    close: 24,
    inset: 8,
    radius: 12,
});
// The ids a provider names its item, its rows and its actions by.
const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const TONES = Object.freeze(['plain', 'attention']);
// The id a row's close button is told by, which no action has.
const CLOSE = 'close';

const within = ({ x, y, width, height }, point) =>
    point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
const clamped = (value, most) => Math.max(0, Math.min(Number.isFinite(value) ? value : 0, most));
const text = (value) => (typeof value === 'string' ? value : '');

// MARK: - Initializer
// MARK: - Public
// The item as the frame takes it, `{ id, name, icon, label, count, tone, fixed, rows, actions }`, or null for one of
// another shape, which is then not there. `icon` is a glyph's name, `{ mod }` or null; `count` a whole number from 0
// on or null; `fixed` whether it stands among those always there; `rows` null for an item nothing opens under, or
// `[{ id, icon, tint, title, detail, meta, state, presses, closes, actions }]`; `actions` `[{ id, title, prominent }]`.
// The rows and the item's own actions share one namespace of ids, and no action is named as the close button is.
function heldTo(item) {
    if (!item || typeof item !== 'object' || !NAME.test(item.id)) return null;
    const actions = actionsOf(item.actions);
    const rows = item.rows == null ? null : Array.isArray(item.rows) ? item.rows.map(rowOf) : [null];
    if (!actions || rows?.includes(null)) return null;
    const ids = [...actions, ...(rows ?? [])].map(({ id }) => id);
    if (new Set(ids).size !== ids.length) return null;
    const count = item.count ?? null;
    if (count !== null && !(Number.isInteger(count) && count >= 0)) return null;
    const tone = item.tone ?? TONES[0];
    if (!TONES.includes(tone)) return null;
    const icon = iconOf(item.icon);
    if (icon === undefined) return null;
    return {
        id: item.id,
        name: text(item.name) || item.id,
        icon,
        label: text(item.label),
        count,
        tone,
        fixed: item.fixed === true,
        rows,
        actions,
    };
}

// The ids of the items there, in the order they began to be: `order` as it was, without those that went, then those
// of `items` that are new.
function orderOf(order, items) {
    const there = items.map(({ id }) => id);
    return [...order.filter((id) => there.includes(id)), ...there.filter((id) => !order.includes(id))];
}

// What a count writes: the number, or the most with a plus beyond it.
function countText(count) {
    return count > COUNT.most ? `${COUNT.most}+` : String(count);
}

// `{ capsule, items: [{ id, rect }] }`: the capsule in the host's bar `strip` on `stage`, CAPSULE.margin in from its
// right end and centred on its height, and each of `items`, in the order they began to be there, right to left: the
// fixed ones first, so the first of them is the rightmost, then those that come and go. An item with a glyph alone
// is 32 wide; a count adds its characters, a label its width in `widths`, a label's text to its measured width.
// With no item there is no capsule.
function barOf(stage, strip, items, widths = {}) {
    const standing = [...items.filter(({ fixed }) => fixed), ...items.filter(({ fixed }) => !fixed)];
    if (!standing.length) return { capsule: null, items: [] };
    const top = Math.max(0, Math.round((strip.height - CAPSULE.height) / 2));
    const y = top + CAPSULE.inset;
    let right = stage.width - CAPSULE.margin - CAPSULE.inset;
    const laid = standing.map((item) => {
        const width = widthOf(item, widths);
        const rect = { x: right - width, y, width, height: ITEM.height };
        right = rect.x - CAPSULE.gap;
        return { id: item.id, rect };
    });
    const x = right + CAPSULE.gap - CAPSULE.inset;
    const capsule = { x, y: top, width: stage.width - CAPSULE.margin - x, height: CAPSULE.height };
    return { capsule, items: laid };
}

// How far the popover of `item` scrolls on `stage` under `strip`: what of its rows its body does not hold.
function mostOf(stage, strip, item) {
    const { header, content, height } = heightsOf(stage, strip, item);
    return Math.max(0, content - (height - header));
}

// The popover of `item`, open under its place in `bar` (barOf) and scrolled by `scroll`: `{ item, rect, header, body,
// rows: [{ id, rect, close, actions: [{ id, rect }] }], scroll, most }`, every rect on the stage. Its right edge is
// in line with the item's, kept POPOVER.margin inside the stage; it is as high as its rows, one row at least, up to
// the desktop's height less the margins, and scrolled beyond that, `scroll` held between 0 and `most`. `header` is
// `{ rect, actions }` where the item has actions of its own, or null; `body` is where the rows show, and a row's
// rect may lie outside it. A row is POPOVER.row high and POPOVER.band more where it has actions; its `close` is the
// rect of its close button, or null. Actions stand in their order, the last at their band's right end, POPOVER.action
// wide each, the first POPOVER.actions of them. Null for an item that is not in the bar or opens nothing.
function popoverOf(stage, strip, bar, item, scroll = 0) {
    const at = item && bar.items.find(({ id }) => id === item.id);
    if (!at || item.rows === null) return null;
    const { header, height } = heightsOf(stage, strip, item);
    const most = mostOf(stage, strip, item);
    const held = clamped(scroll, most);
    const { width, margin } = POPOVER;
    const x = Math.max(margin, Math.min(at.rect.x + at.rect.width - width, stage.width - margin - width));
    const rect = { x, y: strip.height + margin, width, height };
    const body = { x, y: rect.y + header, width, height: height - header };
    let y = body.y - held;
    const rows = item.rows.map((row) => {
        const high = heightOf(row);
        const laid = {
            id: row.id,
            rect: { x, y, width, height: high },
            close: row.closes
                ? {
                      x: x + width - POPOVER.inset - POPOVER.close,
                      y: y + (POPOVER.row - POPOVER.close) / 2,
                      width: POPOVER.close,
                      height: POPOVER.close,
                  }
                : null,
            actions: actionsIn(row.actions, { x, y: y + POPOVER.row, width, height: POPOVER.band }),
        };
        y += high;
        return laid;
    });
    const head = header ? { rect: { ...rect, height: header } } : null;
    if (head) head.actions = actionsIn(item.actions, head.rect);
    return { item: item.id, rect, header: head, body, rows, scroll: held, most };
}

// The part of the bar a point of the stage is on, `{ part, item, row, action }`: `part` 'item', the item itself;
// 'row', 'close' or 'action' in its open popover, `row` null for an action of the item's own; 'popover' inside it on
// nothing; null for any other point. `bar` is as barOf answers it, `popover` as popoverOf does, or null.
function partAt(bar, popover, point) {
    const on = (part, item, row = null, action = null) => ({ part, item, row, action });
    const item = bar.items.find(({ rect }) => within(rect, point));
    if (item) return on('item', item.id);
    if (!popover || !within(popover.rect, point)) return null;
    const own = popover.header?.actions.find(({ rect }) => within(rect, point));
    if (own) return on('action', popover.item, null, own.id);
    const row = within(popover.body, point) && popover.rows.find(({ rect }) => within(rect, point));
    if (!row) return on('popover', popover.item);
    if (row.close && within(row.close, point)) return on('close', popover.item, row.id);
    const action = row.actions.find(({ rect }) => within(rect, point));
    return action ? on('action', popover.item, row.id, action.id) : on('row', popover.item, row.id);
}

// A press let go on the part it went down on: `{ open, tell }`, the seat's open popover after it, `{ item, scroll }`
// or null, and what the item's provider is told, `{ item, row, action }`, or null. A press on an item opens its
// popover in place of the one open, or closes it where it is open, and is told with neither row nor action; one on a
// row that `presses`, on a close button, `action` 'close', or on an action is told and leaves the popover open.
function pressed(open, part, items) {
    const item = part && items.find(({ id }) => id === part.item);
    if (!item) return { open, tell: null };
    const tell = (row, action) => ({ item: item.id, row, action });
    if (part.part === 'item') {
        const opens = item.rows !== null && open?.item !== item.id;
        return { open: opens ? { item: item.id, scroll: 0 } : null, tell: tell(null, null) };
    }
    if (part.part === 'close') return { open, tell: tell(part.row, CLOSE) };
    if (part.part === 'action') return { open, tell: tell(part.row, part.action) };
    const row = part.part === 'row' && item.rows?.find(({ id }) => id === part.row);
    return { open, tell: row?.presses ? tell(row.id, null) : null };
}

// The seat's open popover after a press down on `part` (partAt): closed where it is on no part of the bar.
function downOutside(open, part) {
    return part ? open : null;
}

// The seat's open popover scrolled by `dy` more, held in what `popover`, as it is laid, scrolls.
function scrolled(open, popover, dy) {
    if (!open || !popover) return open;
    return { ...open, scroll: clamped(popover.scroll + dy, popover.most) };
}

// The seat's open popover as `items` are now: closed where its item went or opens nothing, its scroll held in range.
function settled(open, items, stage, strip) {
    const item = open && items.find(({ id }) => id === open.item);
    if (!item || item.rows === null) return null;
    const scroll = clamped(open.scroll, mostOf(stage, strip, item));
    return scroll === open.scroll ? open : { ...open, scroll };
}

// Where what a ref names is: `{ rect, scroll }`, its rect on the stage once the popover is scrolled to `scroll`,
// which brings a row into view, null for an item. A ref is `bar.<item>`, `bar.<item>.<row>`, `bar.<item>.<action>`,
// `bar.<item>.<row>.<action>` or `bar.<item>.<row>.close`; a row's rect is its band beside its close button. Null
// for a ref that names nothing in `bar` or in the open `popover`.
function placeOf(bar, popover, ref) {
    const [head, item, one = null, two = null, ...more] = String(ref).split('.');
    const at = bar.items.find(({ id }) => id === item);
    if (head !== 'bar' || !at || more.length) return null;
    if (one === null) return { rect: at.rect, scroll: null };
    if (popover?.item !== item) return null;
    const own = two === null && popover.header?.actions.find(({ id }) => id === one);
    if (own) return { rect: own.rect, scroll: popover.scroll };
    const row = popover.rows.find(({ id }) => id === one);
    if (!row) return null;
    const { body } = popover;
    const above = row.rect.y - body.y;
    const below = row.rect.y + row.rect.height - (body.y + body.height);
    const by = above < 0 ? above : Math.max(0, Math.min(below, above));
    const band = { ...row.rect, height: POPOVER.row };
    if (row.close) band.width = row.close.x - POPOVER.inset - band.x;
    const rect = two === null ? band : two === CLOSE ? row.close : row.actions.find(({ id }) => id === two)?.rect;
    return rect ? { rect: { ...rect, y: rect.y - by }, scroll: popover.scroll + by } : null;
}

// What the desktop's page draws of the bar: `{ capsule, items: [{ id, rect, name, icon, label, count, tone, open }],
// popover }`, `count` as it is written or null, `open` whether the item's popover is the one shown; `popover` null or
// `{ item, name, rect, body, header, rows }`, `header` `{ rect, actions }` or null, a row `{ id, rect, icon, tint,
// title, detail, meta, state, presses, close, actions }`, only those that show in `body`, and an action
// `{ id, rect, title, prominent }`. Every rect is on the stage.
function shownOf(bar, popover, items) {
    const held = new Map(items.map((item) => [item.id, item]));
    const opened = popover ? held.get(popover.item) : null;
    const worded = (laid, actions) =>
        laid.map(({ id, rect }) => ({ id, rect, ...actions.find((action) => action.id === id) }));
    const shows = ({ rect }) => rect.y < popover.body.y + popover.body.height && rect.y + rect.height > popover.body.y;
    return {
        capsule: bar.capsule,
        items: bar.items.map(({ id, rect }) => {
            const { name, icon, label, count, tone } = held.get(id);
            const written = count === null ? null : countText(count);
            return { id, rect, name, icon, label, count: written, tone, open: opened?.id === id };
        }),
        popover: opened && {
            item: opened.id,
            name: opened.name,
            rect: popover.rect,
            body: popover.body,
            header: popover.header && {
                rect: popover.header.rect,
                actions: worded(popover.header.actions, opened.actions),
            },
            rows: popover.rows.filter(shows).map(({ id, rect, close, actions }) => {
                const row = opened.rows.find((each) => each.id === id);
                return { ...row, rect, close, actions: worded(actions, row.actions) };
            }),
        },
    };
}

// Where the bar takes the pointer: its items, and the popover that is open.
function inputOf(bar, popover) {
    return [...bar.items.map(({ rect }) => rect), ...(popover ? [popover.rect] : [])];
}

// MARK: - Private
function iconOf(icon) {
    if (icon == null) return null;
    if (typeof icon === 'string') return icon;
    return typeof icon === 'object' && NAME.test(icon.mod) ? { mod: icon.mod } : undefined;
}

// `[{ id, title, prominent }]`, or null where one is of another shape.
function actionsOf(actions = []) {
    if (!Array.isArray(actions)) return null;
    const held = actions.map((action) =>
        action && NAME.test(action.id) && action.id !== CLOSE
            ? { id: action.id, title: text(action.title), prominent: action.prominent === true }
            : null
    );
    return held.includes(null) ? null : held;
}

function rowOf(row) {
    if (!row || typeof row !== 'object' || !NAME.test(row.id)) return null;
    const actions = actionsOf(row.actions);
    const icon = iconOf(row.icon);
    if (!actions || icon === undefined) return null;
    return {
        id: row.id,
        icon,
        tint: text(row.tint) || null,
        title: text(row.title),
        detail: text(row.detail),
        meta: text(row.meta),
        state: text(row.state),
        presses: row.presses === true,
        closes: row.closes === true,
        actions,
    };
}

function widthOf({ icon, label, count }, widths) {
    const parts = [
        ...(icon || (!label && count === null) ? [ITEM.glyph] : []),
        ...(label ? [Math.min(Math.ceil(widths[label] ?? label.length * ITEM.letter), ITEM.widest)] : []),
        ...(count === null ? [] : [countText(count).length * COUNT.digit]),
    ];
    return 2 * ITEM.padding + parts.reduce((sum, each) => sum + each, 0) + (parts.length - 1) * ITEM.gap;
}

function heightOf(row) {
    return POPOVER.row + (row.actions.length ? POPOVER.band : 0);
}

// How high the header of the popover of `item` is, its rows together, and the popover itself.
function heightsOf(stage, strip, item) {
    const header = item.actions.length ? POPOVER.header : 0;
    const content = item.rows.reduce((sum, row) => sum + heightOf(row), 0);
    const room = Math.max(0, stage.height - strip.height - 2 * POPOVER.margin);
    return { header, content, height: Math.min(room, header + Math.max(content, POPOVER.row)) };
}

// The first POPOVER.actions of `actions` in `band`, in their order, the last at its right end.
function actionsIn(actions, band) {
    const laid = actions.slice(0, POPOVER.actions);
    const left = band.x + band.width - POPOVER.inset - laid.length * POPOVER.action;
    return laid.map(({ id }, at) => ({
        id,
        rect: { x: left + at * POPOVER.action, y: band.y, width: POPOVER.action, height: band.height },
    }));
}

export {
    CAPSULE,
    ITEM,
    POPOVER,
    heldTo,
    orderOf,
    countText,
    barOf,
    mostOf,
    popoverOf,
    partAt,
    pressed,
    downOutside,
    scrolled,
    settled,
    placeOf,
    shownOf,
    inputOf,
};
