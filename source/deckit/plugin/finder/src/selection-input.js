// Presses and keys in the file area. `walkedFolder()` is the folder the keyboard walks; `entriesIn(folder)` what it
// shows.
function selectionInput({
    areaElement,
    isColumnView,
    location,
    selectedPath,
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
    const DOUBLE_PRESS_INTERVAL = 500; // milliseconds
    const DOUBLE_PRESS_DISTANCE = 5;
    const TYPING_PAUSE = 800; // milliseconds
    let lastPress = null;
    let picking = null; // the path a press in columns is on, picked if the press ends as a click
    let typed = '';
    let typedAt = 0;

    areaElement.addEventListener('mousedown', handlePress);
    areaElement.addEventListener('click', (event) => {
        const path = picking;
        picking = null;
        if (path && event.target.closest('[data-path]')?.dataset.path === path) select(path, { reveal: true });
    });
    areaElement.addEventListener('keydown', handleKey);

    // A second press soon after and where the first was opens what the first was on, even if the columns have since
    // moved another row under the pointer. A right click or a Control-click is the menu's.
    function handlePress(event) {
        if (event.button !== 0 || event.ctrlKey) return;
        const now = Date.now();
        const again =
            lastPress &&
            now - lastPress.at < DOUBLE_PRESS_INTERVAL &&
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
        if (entry && isColumnView()) picking = entry.path;
        else if (entry) select(entry.path);
    }

    async function handleKey(event) {
        const path = selectedPath();
        const folder = walkedFolder();
        const entries = entriesIn(folder);
        const index = entries.findIndex((entry) => entry.path === path);
        // With Command, the arrows are the plugin's keys.
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.metaKey) {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const next = entries[Math.max(0, Math.min(entries.length - 1, index < 0 ? 0 : index + step))];
            if (next) select(next.path, { reveal: true });
        } else if (isColumnView() && event.key === 'ArrowRight') {
            event.preventDefault();
            if (entryAt(path)?.kind !== 'folder') return;
            if (!isLoaded(path)) await load(path);
            const first = entriesIn(path)[0];
            if (first && selectedPath() === path) select(first.path, { reveal: true });
        } else if (isColumnView() && event.key === 'ArrowLeft') {
            event.preventDefault();
            if (path && folder !== location()) select(folder, { reveal: true });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            open(entries[index], { usesDefaultApp: event.altKey });
        } else if (event.key === ' ') {
            event.preventDefault();
            quickLook(entries[index]);
        } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const now = Date.now();
            const letter = event.key.toLowerCase();
            typed = now - typedAt > TYPING_PAUSE ? letter : typed + letter;
            typedAt = now;
            const match = entries.find((entry) => entry.name.toLowerCase().startsWith(typed));
            if (match) select(match.path, { reveal: true });
        }
    }
}

module.exports = { selectionInput };
