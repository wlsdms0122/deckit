// The pick held to what is on screen, run before every draw. A pick the filter hides stays picked. One whose folder no
// longer holds it is cut back to the deepest folder that does (as Finder after a Trash); one whose folder is unread
// waits.
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

// Presses and keys in the file area. `walkedFolder()` is the folder the keyboard walks; `entriesIn(folder)` what it
// shows.
function selectionInput({
    area,
    inColumns,
    currentLocation,
    selected,
    walkedFolder,
    entriesIn,
    entryAt,
    isLoaded,
    load,
    select,
    open,
    openInNewTab,
    quickLook,
}) {
    const DOUBLE_PRESS_MS = 500;
    const DOUBLE_PRESS_DISTANCE = 5;
    const TYPING_PAUSE_MS = 800;
    let lastPress = null;
    let picking = null; // the path a press in columns is on, picked if the press ends as a click
    let typed = '';
    let typedAt = 0;

    area.addEventListener('mousedown', handlePress);
    area.addEventListener('click', (event) => {
        const path = picking;
        picking = null;
        if (path && event.target.closest('[data-path]')?.dataset.path === path) select(path, { reveal: true });
    });
    area.addEventListener('keydown', handleKey);

    // A second press soon after and where the first was opens what the first was on, even if the columns have since
    // moved another row under the pointer. A right click or a Control-click is the menu's.
    function handlePress(event) {
        if (event.button !== 0 || event.ctrlKey) return;
        const now = Date.now();
        const again =
            lastPress &&
            now - lastPress.at < DOUBLE_PRESS_MS &&
            Math.abs(event.clientX - lastPress.x) < DOUBLE_PRESS_DISTANCE &&
            Math.abs(event.clientY - lastPress.y) < DOUBLE_PRESS_DISTANCE;
        if (again) {
            const { entry } = lastPress;
            lastPress = null;
            event.preventDefault();
            if (event.metaKey && entry.kind === 'folder') openInNewTab(entry.path);
            else open(entry, { usesDefaultApp: event.altKey });
            return;
        }
        const entry = entryAt(event.target.closest('[data-path]')?.dataset.path);
        lastPress = entry ? { entry, at: now, x: event.clientX, y: event.clientY } : null;
        // In columns a pick moves the columns, so it waits for the press to end as a click: a press that becomes a
        // drag leaves them as they were.
        picking = null;
        if (entry && inColumns()) picking = entry.path;
        else if (entry) select(entry.path);
    }

    async function handleKey(event) {
        const path = selected();
        const folder = walkedFolder();
        const entries = entriesIn(folder);
        const index = entries.findIndex((entry) => entry.path === path);
        // With Command, the arrows are the plugin's keys.
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.metaKey) {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const next = entries[Math.max(0, Math.min(entries.length - 1, index < 0 ? 0 : index + step))];
            if (next) select(next.path, { reveal: true });
        } else if (inColumns() && event.key === 'ArrowRight') {
            event.preventDefault();
            if (entryAt(path)?.kind !== 'folder') return;
            if (!isLoaded(path)) await load(path);
            const first = entriesIn(path)[0];
            if (first && selected() === path) select(first.path, { reveal: true });
        } else if (inColumns() && event.key === 'ArrowLeft') {
            event.preventDefault();
            if (path && folder !== currentLocation()) select(folder, { reveal: true });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            open(entries[index], { usesDefaultApp: event.altKey });
        } else if (event.key === ' ') {
            event.preventDefault();
            quickLook(entries[index]);
        } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const now = Date.now();
            const letter = event.key.toLowerCase();
            typed = now - typedAt > TYPING_PAUSE_MS ? letter : typed + letter;
            typedAt = now;
            const match = entries.find((entry) => entry.name.toLowerCase().startsWith(typed));
            if (match) select(match.path, { reveal: true });
        }
    }
}
