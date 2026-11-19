// The Seats mod's decisions as plain data: its item in the status bar and the rows of its view, each from who sits
// as the shell tells it (`shell.seats`). Sizes are constants here, so nothing is asked of a page.
// What the item is called, the glyph it shows and the command a press runs.
const ITEM = Object.freeze({ name: 'Seats', icon: 'users', command: 'show' });
// How long the item is labelled with the name of a seat that sat, in milliseconds, and how many characters a label
// holds.
const GREETS = 4000;
const LETTERS = 24;
// The view: its width, the padding round its rows, the room between two rows, and how high a row is.
const VIEW = Object.freeze({ width: 280, padding: 6, gap: 2, row: 28 });

// The item as it stands for `{ seats }`, or null for none: it is there while a seat sits beside the first. Its count
// is the seats beside the first, and its label the name of the seat `greeted`, an id, while that seat sits.
function itemOf({ seats }, greeted = null) {
    if (seats.length < 2) return null;
    const came = seats.find(({ id }) => id === greeted);
    return { ...ITEM, label: came ? cut(came.name) : '', count: seats.length - 1, tone: 'plain' };
}

// The id of the seat that sat since `before`, the last of those in `now` that were not there, or null.
function cameOf(before, now) {
    const were = new Set(before.seats.map(({ id }) => id));
    return now.seats.findLast(({ id }) => !were.has(id))?.id ?? null;
}

// The rows of the view, a seat's each, in the order it is told: `{ key, id, name, colour, idle, following, says,
// label }`, `says` the seat's state that follows the name, and `label` what the row is called.
function rowsOf({ seats }) {
    return seats.map(({ id, name, colour, idle, following }) => {
        const states = [idle && 'idle', following && 'following'].filter(Boolean);
        return {
            key: `seat ${id}`,
            id,
            name,
            colour,
            idle,
            following,
            says: states.join(', '),
            label: [name, ...states].join(', '),
        };
    });
}

// How large the view is with `rows`: `{ width, height }`.
function sizeOf(rows) {
    const high = rows.length * VIEW.row;
    return { width: VIEW.width, height: 2 * VIEW.padding + high + Math.max(0, rows.length - 1) * VIEW.gap };
}

// A name as a label holds it.
function cut(name) {
    return name.length > LETTERS ? name.slice(0, LETTERS - 1) + '…' : name;
}

module.exports = { ITEM, GREETS, LETTERS, VIEW, itemOf, cameOf, rowsOf, sizeOf };
