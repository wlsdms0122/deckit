const { kindIconOf } = require('./icon-cache.js');
const { nameOf, parentOf } = require('./path.js');

// What is done to files: opening, Quick Look, making a folder, renaming, the Trash, and moving by a drag onto a folder.
// Opening, the Trash and a drag take every entry selected (`selection()`). `labelOf(path)` finds the name an entry
// shows, which a rename types over. `onMade(path)` shows a folder just made and answers whether it is in sight, to be
// named. `onMoved(from, to)` hears a path go elsewhere, `to` null when it went to the Trash; `onChanged(folder)` hears
// a folder whose contents changed.
function fileOperations({
    ui,
    openURL,
    fileURL,
    disk,
    areaElement,
    entryAt,
    labelOf,
    selection,
    select,
    onGo,
    onOpenInNewTab,
    onMade,
    onMoved,
    onChanged,
    onStatus,
}) {
    const MOVE = 'finder-entry';

    // A drag from one of several selected entries carries them all.
    ui.dragSource(areaElement, {
        itemAt: (target) => target.closest('[data-path]'),
        describe: (row) => {
            const entry = entryAt(row.dataset.path);
            if (!entry) return null;
            const selected = selection();
            const paths = selected.length > 1 && selected.includes(entry.path) ? selected : [entry.path];
            return {
                kind: MOVE,
                payload: { paths },
                text: paths.length > 1 ? `${paths.length} items` : entry.name,
                icon: entry.kind === 'folder' ? ui.folderIcon({ open: false, size: 14 }) : kindIconOf(entry),
            };
        },
    });

    return { open, quickLook, newFolder, rename, trash, acceptDrops };

    // One folder is gone into; with more than one entry, each folder opens in a tab of its own.
    async function open(entries, { usesDefaultApp = false } = {}) {
        if (entries.length === 1 && entries[0].kind === 'folder') return onGo(entries[0].path);
        for (const entry of entries) {
            if (entry.kind === 'folder') {
                onOpenInNewTab(entry.path);
                continue;
            }
            const opened = await openURL(fileURL(entry.path), { usesDefaultApp, userInitiated: true }).catch(
                () => false
            );
            if (!opened) onStatus('Could not open “' + entry.name + '”');
        }
    }

    function quickLook(entry) {
        if (entry) disk.quickLook(entry.path, entry.name).catch(() => {});
    }

    async function newFolder(into) {
        if (!into) return;
        let made;
        try {
            made = await disk.mkdir(into);
        } catch (error) {
            onStatus('Could not make a folder: ' + error.message);
            return;
        }
        if (!(await onMade(made))) return;
        const entry = entryAt(made);
        if (entry) rename(entry);
    }

    async function rename(entry) {
        const label = labelOf(entry.path);
        if (!label) return;
        select(entry.path);
        const renamed = await ui.inlineEdit(label, {
            selectStem: entry.kind !== 'folder',
            // A refusal thrown here is shown under the name.
            onCommit: async (name) => {
                onMoved(entry.path, await disk.rename(entry.path, name));
            },
        });
        if (renamed) onChanged(parentOf(entry.path));
    }

    // A folder asks first, as everything in it goes too.
    function trash(entries) {
        if (!entries.length) return;
        if (!entries.some((entry) => entry.kind === 'folder')) return moveToTrash(entries);
        if (entries.length === 1)
            return ui.confirmTrash({ name: entries[0].name, onConfirm: () => moveToTrash(entries) });
        ui.dialog({
            title: `Move ${entries.length} items to the Trash?`,
            message: 'They go to the macOS Trash, folders with all they hold, where Finder can put them back.',
            confirmLabel: 'Move to Trash',
            destructive: true,
            onConfirm: () => moveToTrash(entries),
        });
    }

    // Drops into folders under `zone`: `folderAt(element)` answers the folder under the pointer ({ folder, mark }). The
    // entries dragged are all of one folder, so the first answers for them where they would stay.
    function acceptDrops(zone, folderAt) {
        return ui.folderDrop(zone, {
            kind: MOVE,
            path: (payload) => payload.paths[0],
            folderAt,
            onDrop: (payload, place) => move(payload.paths, place.folder),
        });
    }

    async function moveToTrash(entries) {
        for (const entry of entries) {
            try {
                await disk.trash(entry.path);
            } catch (error) {
                onStatus('Could not move “' + entry.name + '” to the Trash: ' + error.message);
                continue;
            }
            onMoved(entry.path, null);
        }
        onChanged(parentOf(entries[0].path));
    }

    // Each one that can go into `into`: a folder dragged onto itself or into what it holds stays.
    async function move(paths, into) {
        const moving = paths.filter((from) => ui.movesInto(from, into));
        for (const from of moving) {
            let to;
            try {
                to = await disk.move(from, into);
            } catch (error) {
                // In a dialog: the footer is drawn again right after a drag ends, which would take a status message
                // away.
                ui.dialog({
                    title: 'Could not move “' + nameOf(from) + '”',
                    message: error.message,
                    confirmLabel: 'OK',
                });
                break;
            }
            onMoved(from, to);
        }
        if (!moving.length) return;
        onChanged(parentOf(moving[0]));
        onChanged(into);
    }
}

module.exports = { fileOperations };
