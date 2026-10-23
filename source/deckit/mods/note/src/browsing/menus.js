const { foldersIn } = require('../notes-folder/folder.js');
const { COMPOSE_SHAPES } = require('../icons/icons.js');
const { parentOf, isWithin } = require('../notes-folder/path.js');

// The context menus of a note and of a folder. `row` is the row or card a menu is about, whose name a rename types over
// while it is still in sight.
function menus({
    ui,
    chordOf,
    relocations,
    fileOperations,
    allNotes,
    openPath,
    onOpenNote,
    onFocusTitle,
    onNewNote,
    labelFor,
}) {
    return { noteItems, folderItems, renameNote, renameFolder };

    function noteItems(path, since = relocations.since(), row = null) {
        return [
            { label: 'Rename…', icon: 'pencil', run: () => renameNote(path, since, row) },
            { label: 'Move to', icon: 'folder', items: moveItems(path, since) },
            '-',
            { label: 'Copy as Markdown', icon: 'copy', run: whenThere(path, since, fileOperations.copyText) },
            { label: 'Show in Finder', icon: 'folder', run: whenThere(path, since, fileOperations.showInFinder) },
            '-',
            {
                label: 'Move to Trash',
                icon: 'trash',
                hint: chordOf('trash'),
                run: () => fileOperations.trashNote(path, since),
            },
        ];
    }

    function folderItems(path, since = relocations.since(), row = null) {
        return [
            {
                label: 'New Note',
                icon: ui.iconOf(COMPOSE_SHAPES, { size: 14 }),
                hint: chordOf('newNote'),
                run: whenThere(path, since, onNewNote),
            },
            {
                label: 'New Folder',
                icon: 'folderPlus',
                hint: chordOf('newFolder'),
                run: whenThere(path, since, fileOperations.newFolder),
            },
            ...(path
                ? [
                      '-',
                      { label: 'Rename…', icon: 'pencil', run: () => renameFolder(path, since, row) },
                      { label: 'Move to', icon: 'folder', items: moveItems(path, since) },
                  ]
                : []),
            '-',
            { label: 'Show in Finder', icon: 'folder', run: whenThere(path, since, fileOperations.showInFinder) },
            ...(path
                ? [
                      {
                          label: 'Move to Trash',
                          icon: 'trash',
                          hint: chordOf('trash'),
                          run: () => fileOperations.trashFolder(path, since),
                      },
                  ]
                : []),
        ];
    }

    function moveItems(path, since) {
        const top = allNotes();
        return [
            {
                label: 'All Notes',
                checked: parentOf(path) === '',
                run: () => fileOperations.move(path, '', since, top.since),
            },
            ...foldersIn(top)
                .filter((folder) => !isWithin(folder.path, path))
                .map((folder) => ({
                    label: ' '.repeat(folder.depth + 1) + folder.name,
                    checked: parentOf(path) === folder.path,
                    run: () => fileOperations.move(path, folder.path, since, top.since),
                })),
        ];
    }

    // Out of sight, the note is opened and its title field takes the name.
    async function renameNote(path, since, row) {
        const label = row?.isConnected && row.querySelector('[data-name]');
        if (label) return fileOperations.rename(label, path, since);
        const current = await relocations.currentPath(path, since);
        if (current == null || (current !== openPath() && !(await onOpenNote(current)))) return;
        onFocusTitle();
    }

    async function renameFolder(path, since, row) {
        const current = await relocations.currentPath(path, since);
        const label =
            current != null && ((row?.isConnected && row.querySelector('[data-name]')) || (await labelFor(current)));
        if (label) fileOperations.rename(label, path, since);
    }

    function whenThere(path, since, act) {
        return async () => {
            const current = await relocations.currentPath(path, since);
            if (current != null) act(current);
        };
    }
}

module.exports = { menus };
