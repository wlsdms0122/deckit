const { kindIconOf } = require('./icon-cache.js');
const { nameOf, parentOf } = require('./path.js');

// What is done to files: opening, Quick Look, making a folder, renaming, the Trash, and moving by a drag onto a folder.
// Opening and the Trash take the entries given; a drag from one of several selected (`selection()`) carries them all.
// `labelOf(path)` finds the name an entry shows, which a rename types over. `onMade(path)` shows a folder just made and
// answers whether it is in sight, to be named. `onMoved(from, to)` hears a path go elsewhere, `to` null when it went to
// the Trash; `onChanged(folder)` hears a folder whose contents changed.
function fileOperator({
    ui,
    openURL,
    fileURL,
    disk,
    areaElement,
    draggableRowAt,
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
        itemAt: draggableRowAt,
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
            const opened = await openURL(fileURL(entry.path), { usesDefaultApp }).catch(() => false);
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

    // Drops into folders under `zone`: `folderAt(element)` answers the folder under the pointer ({ folder, mark }).
    function acceptDrops(zone, folderAt) {
        return ui.folderDrop(zone, {
            kind: MOVE,
            paths: (payload) => payload.paths,
            folderAt,
            onDrop: (payload, place) => move(payload.paths, place.folder),
        });
    }

    // A failure is told in the footer when nothing went, or else in a dialog: the folder read again draws the footer
    // anew.
    async function moveToTrash(entries) {
        const failures = [];
        for (const entry of entries) {
            try {
                await disk.trash(entry.path);
                onMoved(entry.path, null);
            } catch (error) {
                failures.push({ entry, error });
            }
        }
        if (!failures.length) return onChanged(parentOf(entries[0].path));
        const title =
            failures.length === 1
                ? 'Could not move “' + failures[0].entry.name + '” to the Trash'
                : `Could not move ${failures.length} items to the Trash`;
        if (failures.length === entries.length)
            return onStatus(failures.length === 1 ? title + ': ' + failures[0].error.message : title);
        onChanged(parentOf(entries[0].path));
        ui.dialog({ title, message: failures.map(({ error }) => error.message), confirmLabel: 'OK' });
    }

    // Each one that can go into `into`; one that fails does not keep the others. A failure is told in a dialog: the
    // footer is drawn again right after a drag ends, which would take a status message away.
    async function move(paths, into) {
        const moving = paths.filter((from) => ui.movesInto(from, into));
        const failures = [];
        for (const from of moving) {
            try {
                onMoved(from, await disk.move(from, into));
            } catch (error) {
                failures.push({ from, error });
            }
        }
        if (!moving.length) return;
        onChanged(parentOf(moving[0]));
        onChanged(into);
        if (!failures.length) return;
        ui.dialog({
            title:
                failures.length === 1
                    ? 'Could not move “' + nameOf(failures[0].from) + '”'
                    : `Could not move ${failures.length} items`,
            message: failures.map(({ error }) => error.message),
            confirmLabel: 'OK',
        });
    }
}

module.exports = { fileOperator };
