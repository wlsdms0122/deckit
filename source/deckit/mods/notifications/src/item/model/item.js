// The Notifications mod's item in the status bar as plain data. The item is declared in the manifest (its name, the
// glyph `bell` and the command a press runs), so it stands with an empty record and before the mod runs; what is set
// while it runs is the count and the tone alone.
// How long the item asks for attention once a notification arrived, in milliseconds.
const RINGS = 4000;

// What the mod sets of its item: `count` the record's length, none while it is empty, and `tone` `attention` while
// `rings`, a notification having just arrived.
function itemOf(count, rings = false) {
    return { count: count > 0 ? count : null, tone: rings ? 'attention' : 'plain' };
}

// Whether a notification arrived between two readings of the record, each the ids newest first: the newest now was
// not there before.
function arrivedOf(before, now) {
    return now.length > 0 && !before.includes(now[0]);
}

module.exports = { RINGS, itemOf, arrivedOf };
