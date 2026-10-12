// What can be done to the files and folders in a workspace's tree: make one, rename, move, put in the Trash, and the
// tree's menu. The open files under an entry are held while it moves (disk.holding), so no save of theirs lands on the
// old path; `relocate` then has everything that knew the old path follow it.
function entryActions({ ui, host, main, disk, filesUnder, isDirty, relocate, relist, open, drop, showFiles, findIn }) {
    return { menuOf, create, createHere, move, trash, pathItems };

    // `entry` null is the space around the rows: the top folder.
    function menuOf(workspace) {
        return (entry) => {
            const folder = !entry ? workspace.root : entry.folder ? entry.path : null;
            const making = folder
                ? [
                      {
                          label: 'New File',
                          icon: 'filePlus',
                          hint: host.chordOf('newFile'),
                          run: () => create(workspace, folder, 'file'),
                      },
                      {
                          label: 'New Folder',
                          icon: 'folderPlus',
                          hint: host.chordOf('newFolder'),
                          run: () => create(workspace, folder, 'folder'),
                      },
                  ]
                : [];
            if (!entry) return [...making, '-', ...pathItems(workspace.root, '')];
            const relative = relativePath(entry.path, workspace.root);
            return [
                entry.folder
                    ? { label: 'Find in Folder', icon: 'search', run: () => findIn(workspace, relative) }
                    : { label: 'Open', icon: 'fileText', run: () => open(entry.path, { preview: false }) },
                ...(making.length ? ['-', ...making] : []),
                '-',
                { label: 'Rename…', icon: 'pencil', run: () => rename(workspace, entry) },
                {
                    label: 'Move to Trash',
                    icon: 'trash',
                    hint: host.chordOf('trash'),
                    run: () => trash(workspace, entry),
                },
                '-',
                ...pathItems(entry.path, relative),
            ];
        };
    }

    function pathItems(path, relative) {
        return [
            { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(path) },
            { label: 'Copy Path', icon: 'copy', run: () => host.clipboard.writeText(path).catch(() => {}) },
            ...(relative
                ? [{ label: 'Copy Relative Path', run: () => host.clipboard.writeText(relative).catch(() => {}) }]
                : []),
        ];
    }

    // `type` is 'file' or 'folder'. Made with a free name, then named in place; a file opens once named.
    async function create(workspace, folder, type) {
        let made;
        try {
            made = await main.call(type === 'folder' ? 'mkdir' : 'create', folder);
        } catch (error) {
            ui.dialog({ title: `Could not make a new ${type}`, message: error.message, confirmLabel: 'OK' });
            return;
        }
        showFiles(workspace);
        relist(workspace);
        const label = await workspace.tree.nameAt(made);
        const named = label ? await renameAt(workspace, made, label, { stem: false }) : made;
        if (type === 'file') open(named, { preview: false });
    }

    // In the folder picked in the tree, or the one of the file picked, or else of the open file, or else the top.
    function createHere(workspace, file, type) {
        if (!workspace?.root) return;
        const picked = workspace.tree.picked();
        const folder = picked
            ? picked.folder
                ? picked.path
                : parentOf(picked.path)
            : file && isInside(file.path, workspace.root)
              ? parentOf(file.path)
              : workspace.root;
        create(workspace, folder, type);
    }

    async function rename(workspace, entry) {
        const label = await workspace.tree.nameAt(entry.path);
        if (label) await renameAt(workspace, entry.path, label, { stem: !entry.folder });
    }

    async function renameAt(workspace, from, label, { stem }) {
        let at = from;
        await ui.inlineEdit(label, {
            selectStem: stem,
            onCommit: async (name) => {
                try {
                    await disk.holding(filesUnder(from), async () => {
                        at = await main.call('rename', from, name);
                        relocate(from, at);
                    });
                } catch (error) {
                    return error.message;
                }
            },
        });
        if (at !== from) {
            await workspace.tree.refresh();
            relist(workspace);
        }
        return at;
    }

    // relocate has the trees follow the move, which reads them again.
    async function move(workspace, entry, folder) {
        let at = null;
        try {
            await disk.holding(filesUnder(entry.path), async () => {
                at = await main.call('move', entry.path, folder);
                relocate(entry.path, at);
            });
        } catch (error) {
            ui.dialog({ title: `Could not move ${entry.name}`, message: error.message, confirmLabel: 'OK' });
            return;
        }
        relist(workspace);
        if (at) workspace.tree.reveal(at);
    }

    // An open file with unsaved changes stays open, shown as deleted on disk; one without closes.
    function trash(workspace, entry) {
        if (!entry.folder) return moveToTrash(workspace, entry);
        ui.confirmTrash({ name: entry.name, onConfirm: () => moveToTrash(workspace, entry) });
    }

    async function moveToTrash(workspace, entry) {
        const under = filesUnder(entry.path);
        try {
            await disk.holding(under, () => main.call('trash', entry.path));
        } catch (error) {
            ui.dialog({
                title: `Could not move ${entry.name} to the Trash`,
                message: error.message,
                confirmLabel: 'OK',
            });
            return;
        }
        for (const file of under) {
            if (isDirty(file)) disk.check(file).catch(() => false);
            else drop(file);
        }
        relocate(entry.path, null);
        await workspace.tree.refresh();
        relist(workspace);
    }
}
