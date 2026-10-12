// What is done to files: opening, Quick Look, making a folder, renaming, the Trash, and moving by a drag onto a folder.
// `labelOf(path)` finds the name an entry shows, which a rename types over. `onMade(path)` shows a folder just made and
// answers whether it is in sight, to be named. `onMoved(from, to)` hears a path go elsewhere, `to` null when it went to
// the Trash; `onChanged(folder)` hears a folder whose contents changed.
function fileOperations({
    ui,
    host,
    main,
    areaElement,
    entryAt,
    labelOf,
    select,
    onGo,
    onMade,
    onMoved,
    onChanged,
    onStatus,
}) {
    const MOVE = 'finder-entry';

    ui.dragSource(areaElement, {
        itemAt: (target) => target.closest('[data-path]'),
        describe: (row) => {
            const entry = entryAt(row.dataset.path);
            return (
                entry && {
                    kind: MOVE,
                    payload: { path: entry.path },
                    text: entry.name,
                    icon: entry.kind === 'folder' ? ui.folderIcon({ open: false, size: 14 }) : kindIconOf(entry),
                }
            );
        },
    });

    return { open, quickLook, newFolder, rename, trash, acceptDrops };

    async function open(entry, { usesDefaultApp = false } = {}) {
        if (!entry) return;
        if (entry.kind === 'folder') return onGo(entry.path);
        const opened = await host
            .open(host.fileURL(entry.path), { usesDefaultApp, userInitiated: true })
            .catch(() => false);
        if (!opened) onStatus('Could not open “' + entry.name + '”');
    }

    function quickLook(entry) {
        if (entry) main.call('quickLook', entry.path, entry.name).catch(() => {});
    }

    async function newFolder(into) {
        if (!into) return;
        let made;
        try {
            made = await main.call('mkdir', into);
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
                onMoved(entry.path, await main.call('rename', entry.path, name));
            },
        });
        if (renamed) onChanged(parentOf(entry.path));
    }

    function trash(entry) {
        if (!entry) return;
        if (entry.kind !== 'folder') return moveToTrash(entry);
        ui.confirmTrash({ name: entry.name, onConfirm: () => moveToTrash(entry) });
    }

    // Drops into folders under `zone`: `folderAt(element)` answers the folder under the pointer ({ folder, mark }).
    function acceptDrops(zone, folderAt) {
        return ui.folderDrop(zone, {
            kind: MOVE,
            path: (payload) => payload.path,
            folderAt,
            onDrop: (payload, place) => move(payload.path, place.folder),
        });
    }

    async function moveToTrash(entry) {
        try {
            await main.call('trash', entry.path);
        } catch (error) {
            onStatus('Could not move “' + entry.name + '” to the Trash: ' + error.message);
            return;
        }
        onMoved(entry.path, null);
        onChanged(parentOf(entry.path));
    }

    async function move(from, into) {
        if (!ui.movesInto(from, into)) return;
        let to;
        try {
            to = await main.call('move', from, into);
        } catch (error) {
            // In a dialog: the footer is drawn again right after a drag ends, which would take a status message away.
            ui.dialog({
                title: 'Could not move “' + nameOf(from) + '”',
                message: error.message,
                confirmLabel: 'OK',
            });
            return;
        }
        onMoved(from, to);
        onChanged(parentOf(from));
        onChanged(into);
    }
}
