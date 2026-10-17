// The file area's context menu: its items for an entry, for several selected entries, and for a folder in the space
// around its entries. `folderAt(element)` is the column under a press ({ folder, mark }); `workingFolder()` is the
// folder in front when the press is on no column. A press on an entry outside the selection selects it alone.
function fileMenu({
    ui,
    chordOf,
    reveal,
    writeText,
    areaElement,
    entryAt,
    rowOf,
    folderAt,
    selectedPath,
    selection,
    workingFolder,
    select,
    isFavorite,
    onAddFavorite,
    onRemoveFavorite,
    open,
    openInNewTab,
    quickLook,
    rename,
    trash,
    newFolder,
    showsHidden,
    onToggleHidden,
    onGoToFolder,
}) {
    return ui.contextMenu(areaElement, {
        rowAt: (target) => target.closest('[data-path]') || folderAt(target)?.mark || null,
        keyRow: () => (selectedPath() ? rowOf(selectedPath()) : null),
        items: (row) => {
            if (row?.dataset.path) {
                const entry = entryAt(row.dataset.path);
                if (!entry) return null;
                const selected = selection().map(entryAt).filter(Boolean);
                if (selected.length > 1 && selection().includes(entry.path)) return selectionItems(selected);
                select(entry.path);
                return entryItems(entry);
            }
            const folder = (row && folderAt(row)?.folder) || workingFolder();
            return folder ? folderItems(folder) : null;
        },
    });

    function entryItems(entry) {
        const folder = entry.kind === 'folder';
        return [
            {
                label: 'Open',
                icon: folder ? 'folder' : 'externalWindow',
                hint: chordOf('open'),
                run: () => open([entry]),
            },
            folder
                ? { label: 'Open in New Tab', icon: 'window', hint: '⌘', run: () => openInNewTab(entry.path) }
                : { label: 'Open with Default App', hint: '⌥', run: () => open([entry], { usesDefaultApp: true }) },
            { label: 'Quick Look', icon: 'eye', hint: 'Space', run: () => quickLook(entry) },
            '-',
            { label: 'Rename…', icon: 'pencil', run: () => rename(entry) },
            { label: 'Move to Trash', icon: 'trash', hint: chordOf('trash'), run: () => trash([entry]) },
            '-',
            { label: 'Show in Finder', icon: 'folder', run: () => reveal(entry.path) },
            { label: 'Copy Path', icon: 'copy', run: () => copyPath(entry.path) },
            ...(folder ? ['-', favoriteItem(entry.path)] : []),
        ];
    }

    function selectionItems(entries) {
        const count = `${entries.length} Items`;
        return [
            { label: `Open ${count}`, icon: 'externalWindow', hint: chordOf('open'), run: () => open(entries) },
            '-',
            { label: 'Move to Trash', icon: 'trash', hint: chordOf('trash'), run: () => trash(entries) },
            '-',
            { label: 'Copy Paths', icon: 'copy', run: () => copyPath(entries.map((entry) => entry.path).join('\n')) },
        ];
    }

    function favoriteItem(path) {
        return isFavorite(path)
            ? { label: 'Remove from Favorites', icon: 'star', run: () => onRemoveFavorite(path) }
            : { label: 'Add to Favorites', icon: 'star', run: () => onAddFavorite(path) };
    }

    function folderItems(folder) {
        return [
            { label: 'New Folder', icon: 'folderPlus', hint: chordOf('newFolder'), run: () => newFolder(folder) },
            { label: 'Go to Folder…', hint: chordOf('goToFolder'), run: onGoToFolder },
            '-',
            { label: 'Show in Finder', icon: 'folder', run: () => reveal(folder) },
            { label: 'Copy Path', icon: 'copy', run: () => copyPath(folder) },
            {
                label: 'Add to Favorites',
                icon: 'star',
                disabled: isFavorite(folder),
                run: () => onAddFavorite(folder),
            },
            '-',
            {
                label: 'Show Hidden Files',
                checked: showsHidden(),
                hint: chordOf('hidden'),
                run: onToggleHidden,
            },
        ];
    }

    function copyPath(path) {
        writeText(path).catch(() => {});
    }
}

module.exports = { fileMenu };
