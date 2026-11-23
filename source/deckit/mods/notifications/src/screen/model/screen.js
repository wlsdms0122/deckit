// The sizes of what the Notifications mod puts on screen, as plain data: the center's view under the mod's item in
// the status bar, and the toasts' view at the top right. Each view is one surface and a notification an item on it,
// as high as what it holds, which only a page knows, so a view opens as high as its items are guessed to be and is
// sized again to what they measure.
const WIDTH = 360;
// The room between two items, and between the center's head and its rows.
const GAP = 4;
// The room around what a view holds, and inside an item about what it shows: an item's fill is ROOM in from the
// view's edge, rounded by the view's corner less ROOM, and its words are ROOM + INSET in.
const ROOM = 4;
const INSET = 8;
// The center's head, and the empty record's words under it.
const HEAD = 32;
const EMPTY = 196;
// The most the center's view is high: a longer record scrolls in it.
const MOST = 560;
// What an item is guessed to be high: its inset and title, a body of two lines, a row of actions.
const ITEM = Object.freeze({ plain: 36, body: 42, actions: 28 });

// How high the item of `notification` is guessed to be.
function guessOf({ body = '', actions = [] }) {
    return ITEM.plain + (body ? ITEM.body : 0) + (actions.length ? ITEM.actions : 0);
}

// What the item of `notification` shows, as plain data: `{ name, title, body, sender, icon, time, actions }`, `title`
// the sender's name where it has none, `name` what the card is called, its title and its body, `icon` the sender's
// app icon as it is read, '' for none, `time` when it came as a row writes it, '' on a toast, and `actions` the titles
// of its actions. An item that shows the same is not drawn anew.
function itemOf({ title, body = '', mod, actions = [] }, { icon = '', time = '' } = {}) {
    const titles = actions.map((action) => action.title);
    const shown = title || mod.name;
    const name = [shown, body].filter(Boolean).join(', ');
    return { name, title: shown, body, sender: mod.name, icon, time, actions: titles };
}

// The center's view, `{ width, height }`: `rows` the heights of its rows in order, none for an empty record. It is
// never higher than MOST.
function centerSize(rows) {
    const body = rows.length ? stacked(rows) : EMPTY;
    return { width: WIDTH, height: Math.min(MOST, Math.ceil(2 * ROOM + HEAD + GAP + body)) };
}

// The toasts' view, `{ width, height }`: `items` the heights of the toasts it holds in order, one at least.
function toastsSize(items) {
    return { width: WIDTH, height: Math.ceil(2 * ROOM + stacked(items)) };
}

// `heights` one under another, GAP apart.
function stacked(heights) {
    return heights.reduce((sum, each) => sum + each, 0) + Math.max(0, heights.length - 1) * GAP;
}

module.exports = { WIDTH, GAP, ROOM, INSET, HEAD, EMPTY, MOST, ITEM, guessOf, itemOf, centerSize, toastsSize };
