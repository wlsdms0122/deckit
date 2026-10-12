// The menus of the file area: an entry's, and a folder's in the space around its entries. `folderAt(element)` is the
// column under a press ({ folder, mark }); `workingFolder()` is the folder in front when the press is on no column.
function fileMenus({
    ui,
    host,
    areaElement,
    entryAt,
    rowOf,
    folderAt,
    selectedPath,
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
}) {
    return ui.contextMenu(areaElement, {
        rowAt: (target) => target.closest('[data-path]') || folderAt(target)?.mark || null,
        keyRow: () => (selectedPath() ? rowOf(selectedPath()) : null),
        items: (row) => {
            if (row?.dataset.path) {
                const entry = entryAt(row.dataset.path);
                if (!entry) return null;
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
            { label: 'Open', icon: folder ? 'folder' : 'externalWindow', run: () => open(entry) },
            folder
                ? { label: 'Open in New Tab', icon: 'window', hint: '⌘', run: () => openInNewTab(entry.path) }
                : { label: 'Open with Default App', hint: '⌥', run: () => open(entry, { usesDefaultApp: true }) },
            { label: 'Quick Look', icon: 'eye', hint: 'Space', run: () => quickLook(entry) },
            '-',
            { label: 'Rename…', icon: 'pencil', run: () => rename(entry) },
            { label: 'Move to Trash', icon: 'trash', hint: host.chordOf('trash'), run: () => trash(entry) },
            '-',
            { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(entry.path) },
            { label: 'Copy Path', icon: 'copy', run: () => copyPath(entry.path) },
            ...(folder ? ['-', favoriteItem(entry.path)] : []),
        ];
    }

    function favoriteItem(path) {
        return isFavorite(path)
            ? { label: 'Remove from Favorites', icon: 'star', run: () => onRemoveFavorite(path) }
            : { label: 'Add to Favorites', icon: 'star', run: () => onAddFavorite(path) };
    }

    function folderItems(folder) {
        return [
            { label: 'New Folder', icon: 'folderPlus', hint: host.chordOf('newFolder'), run: () => newFolder(folder) },
            '-',
            { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(folder) },
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
                hint: host.chordOf('hidden'),
                run: onToggleHidden,
            },
        ];
    }

    function copyPath(path) {
        host.clipboard.writeText(path).catch(() => {});
    }
}
