const { parentOf, isInside } = require('./path.js');

// Presses and keys in the file area. `walkedFolder()` is the folder the keyboard walks; `entriesIn(folder)` what it
// shows. Command adds or takes away an entry, Shift selects the range from the anchor; `open(entries)` opens what is
// selected. In columns Right goes into a folder, whose column is to its right, and Left back out, never past the tab's
// folder.
function selectionInput({
    ui,
    areaElement,
    isColumnView,
    location,
    selectedPath,
    selection,
    walkedFolder,
    entriesIn,
    entryAt,
    isLoaded,
    load,
    select,
    toggle,
    extend,
    selectAll,
    open,
    openInNewTab,
    rename,
    quickLook,
}) {
    const DOUBLE_PRESS_INTERVAL = 500; // milliseconds
    const DOUBLE_PRESS_DISTANCE = 5;
    let lastPress = null;
    let picking = null; // the path a press is on, selected if the press ends as a click

    areaElement.addEventListener('mousedown', handlePress);
    areaElement.addEventListener('click', (event) => {
        const path = picking;
        picking = null;
        if (path && event.target.closest('[data-path]')?.dataset.path === path) select(path, { reveal: true });
    });
    ui.tree(areaElement, {
        items: () => entriesIn(walkedFolder()).map((entry) => entry.path),
        lead: selectedPath,
        nameOf: (path) => entryAt(path).name,
        multiple: true,
        parentOf: (path) => (isColumnView() && isInside(parentOf(path), location()) ? parentOf(path) : null),
        childrenOf: (path) => (isColumnView() ? childrenOf(path) : []),
        onSelect: (path, { extend: extending }) => (extending ? extend : select)(path, { reveal: true }),
        onSelectAll: selectAll,
        onPreview: (path) => quickLook(entryAt(path)),
        // As in macOS Finder, Return renames one entry and leaves several alone.
        onRename: (path) => selection().length === 1 && rename(entryAt(path)),
        onOpen: () => open(selected()),
    });

    // A second press soon after and where the first was opens what the first was on, with the rest selected then when
    // it was one of several, even if the columns have since moved another row under the pointer. A right click or a
    // Control-click is the menu's.
    function handlePress(event) {
        if (event.button !== 0 || event.ctrlKey) return;
        const now = Date.now();
        const again =
            lastPress &&
            now - lastPress.at < DOUBLE_PRESS_INTERVAL &&
            Math.abs(event.clientX - lastPress.x) < DOUBLE_PRESS_DISTANCE &&
            Math.abs(event.clientY - lastPress.y) < DOUBLE_PRESS_DISTANCE;
        if (again) {
            const { entry, selection: then } = lastPress;
            lastPress = null;
            event.preventDefault();
            if (event.metaKey && entry.kind === 'folder') openInNewTab(entry.path);
            else
                open(then.includes(entry.path) ? then.map(entryAt).filter(Boolean) : [entry], {
                    usesDefaultApp: event.altKey,
                });
            return;
        }
        const entry = entryAt(event.target.closest('[data-path]')?.dataset.path);
        picking = null;
        if (entry) pressOn(entry, event);
        // The selection as this press left it: the click may narrow it before a second press.
        lastPress = entry ? { entry, selection: selection(), at: now, x: event.clientX, y: event.clientY } : null;
    }

    // In columns a selection moves the columns, and a press on one of several selected entries may drag them all:
    // either waits for the press to end as a click, and a press that becomes a drag leaves them as they were.
    function pressOn(entry, event) {
        if (event.metaKey) toggle(entry.path);
        else if (event.shiftKey) extend(entry.path);
        else if (isColumnView() || (selection().length > 1 && selection().includes(entry.path))) picking = entry.path;
        else select(entry.path);
    }

    function selected() {
        return selection().map(entryAt).filter(Boolean);
    }

    async function childrenOf(path) {
        if (entryAt(path)?.kind !== 'folder') return [];
        if (!isLoaded(path)) await load(path);
        return entriesIn(path).map((entry) => entry.path);
    }
}

module.exports = { selectionInput };
