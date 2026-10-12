// The context menus: of a note, of a folder, and of the text in the editor. `row` is the row or card a menu is about,
// whose name a rename types over while it is still in sight.
function menus({
    ui,
    host,
    editor,
    relocations,
    fileOperations,
    allNotes,
    notePath,
    onOpenNote,
    onFocusTitle,
    onNewNote,
    labelFor,
    followLink,
}) {
    return { noteItems, folderItems, editorItems };

    function noteItems(path, since = relocations.count(), row = null) {
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
                hint: host.chordOf('trash'),
                run: () => fileOperations.trashNote(path, since),
            },
        ];
    }

    function folderItems(path, since = relocations.count(), row = null) {
        return [
            {
                label: 'New Note',
                icon: ui.iconOf(COMPOSE_SHAPES, { size: 14 }),
                hint: host.chordOf('newNote'),
                run: whenThere(path, since, onNewNote),
            },
            {
                label: 'New Folder',
                icon: 'folderPlus',
                hint: host.chordOf('newFolder'),
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
                          hint: host.chordOf('trash'),
                          run: () => fileOperations.trashFolder(path, since),
                      },
                  ]
                : []),
        ];
    }

    // `href` is the link the menu was opened on, if any.
    function editorItems(href) {
        const items = [];
        if (href) {
            items.push(
                {
                    label: 'Open Link',
                    icon: 'externalWindow',
                    disabled: !linkTargetOf(href),
                    run: () => followLink(href),
                },
                { label: 'Copy Link', icon: 'link', run: () => copy(href) },
                { label: 'Edit Link…', hint: '⌘K', run: () => editor.editLink() },
                '-'
            );
        }
        if (editor.selectionText())
            items.push({ label: 'Copy', hint: '⌘C', run: () => copy(editor.selectionText()) }, '-');
        const current = editor.paragraphStyle();
        items.push(
            ...PARAGRAPH_STYLES.map((style) =>
                style === '-'
                    ? '-'
                    : {
                          label: style.label,
                          hint: host.chordOf(style.key),
                          checked: current === style.key,
                          run: () => editor.setParagraphStyle(style.key),
                      }
            )
        );
        return items;
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
                .filter((folder) => !isWithin(folder.rel, path))
                .map((folder) => ({
                    label: ' '.repeat(folder.depth + 1) + folder.name,
                    checked: parentOf(path) === folder.rel,
                    run: () => fileOperations.move(path, folder.rel, since, top.since),
                })),
        ];
    }

    // Out of sight, the note is opened and its title field takes the name.
    async function renameNote(path, since, row) {
        const label = row?.isConnected && row.querySelector('[data-name]');
        if (label) return fileOperations.rename(label, path, since);
        const current = await relocations.currentPath(path, since);
        if (current == null || (current !== notePath() && !(await onOpenNote(current)))) return;
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

    function copy(text) {
        host.clipboard.writeText(text).catch(() => {});
    }
}
