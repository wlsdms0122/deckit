// The sizes of what the Notifications mod puts on screen, as plain data: the center's view under the mod's item in
// the status bar, and the toasts' view at the top right. A card is as high as what it holds, which only a page
// knows, so a view opens as high as its cards are guessed to be and is sized again to what they measure.
const WIDTH = 360;
// The room between two cards.
const GAP = 8;
// The room around the center's head and rows, and around the toasts.
const ROOM = Object.freeze({ center: 16, toasts: 8 });
// The center's head, and the empty record's words under it.
const HEAD = 32;
const EMPTY = 168;
// The most the center's view is high: a longer record scrolls in it.
const MOST = 560;
// What a card is guessed to be high: its padding and title, a body of two lines, a row of actions.
const CARD = Object.freeze({ plain: 44, body: 40, actions: 32 });

// How high the card of `notification` is guessed to be.
function guessOf({ body = '', actions = [] }) {
    return CARD.plain + (body ? CARD.body : 0) + (actions.length ? CARD.actions : 0);
}

// What the card of `notification` shows, as plain data: `{ title, body, sender, icon, time, actions }`, `title` the
// sender's name where it has none, `icon` the sender's app icon as it is read, '' for none, `time` when it came as a
// row writes it, '' on a toast, and `actions` the titles of its actions. A card that shows the same is not drawn anew.
function cardOf({ title, body = '', mod, actions = [] }, { icon = '', time = '' } = {}) {
    const titles = actions.map((action) => action.title);
    return { title: title || mod.name, body, sender: mod.name, icon, time, actions: titles };
}

// The center's view, `{ width, height }`: `rows` the heights of its rows in order, none for an empty record. It is
// never higher than MOST.
function centerSize(rows) {
    const body = rows.length ? stacked(rows) : EMPTY;
    return { width: WIDTH, height: Math.min(MOST, Math.ceil(2 * ROOM.center + HEAD + GAP + body)) };
}

// The toasts' view, `{ width, height }`: `cards` the heights of the toasts it holds in order, one at least.
function toastsSize(cards) {
    return { width: WIDTH, height: Math.ceil(2 * ROOM.toasts + stacked(cards)) };
}

// `heights` one under another, GAP apart.
function stacked(heights) {
    return heights.reduce((sum, each) => sum + each, 0) + Math.max(0, heights.length - 1) * GAP;
}

module.exports = { WIDTH, GAP, ROOM, HEAD, EMPTY, MOST, CARD, guessOf, cardOf, centerSize, toastsSize };
