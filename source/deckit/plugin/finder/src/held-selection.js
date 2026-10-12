const { childOf, isInside, stepsFrom } = require('./path.js');
const { isVisible } = require('./sort.js');

// The pick held to what is on screen, run before every draw. A pick the filter hides stays picked. One whose folder no
// longer holds it is cut back to the deepest folder that does; one whose folder is unread waits.
function heldSelection({ location, selected, inColumns, listingOf, showHidden }) {
    if (!selected) return selected;
    const steps = isInside(selected, location) ? stepsFrom(location, selected) : [];
    let kept = null;
    let folder = location;
    for (const name of steps) {
        const next = childOf(folder, name);
        const listing = listingOf(folder);
        if (!listing) return inColumns ? selected : childOf(location, steps[0]);
        if (!listing.entries.some((entry) => entry.path === next && isVisible(entry, showHidden))) break;
        kept = next;
        if (!inColumns) break;
        folder = next;
    }
    return kept;
}

module.exports = { heldSelection };
