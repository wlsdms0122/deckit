// The sidebar: every folder and note under All Notes, folded as the person left them.
function tree({
    ui,
    host,
    store,
    movePath,
    noteMenu,
    folderMenu,
    describeDrag,
    acceptDrops,
    onOpenNote,
    onOpenFolder,
    onShowAll,
    onNewNote,
    onNewFolder,
    onToggle,
}) {
    const STYLE = `
        .note-sidebar { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
        .note-tree-glyph { display: flex; color: var(--deckit-muted); }
    `;

    let expanded = new Set(store.get('expanded', []));

    ui.addStyle(STYLE);
    const noteGlyph = `<span class="note-tree-glyph">${ui.icon('fileText', { size: 16 })}</span>`;
    const element = ui.element('div', { className: 'note-sidebar' });
    const section = ui.section({
        label: 'All Notes',
        icon: ui.iconOf(NOTEBOOK_SHAPES, { size: 16 }),
        actions: [
            { icon: ui.iconOf(COMPOSE_SHAPES, { size: 16 }), title: 'New note', run: () => onNewNote() },
            { icon: ui.icon('folderPlus', { size: 16 }), title: 'New folder', run: () => onNewFolder() },
        ],
        onHeading: () => {
            host.show();
            onShowAll();
        },
        onHeadingMenu: (event) => ui.menu({ items: folderMenu(''), point: { x: event.clientX, y: event.clientY } }),
    });
    const rows = ui.list({ key: (item) => item.path, create: rowOf });

    section.body.append(rows.element);
    element.append(section.element);
    ui.tooltip(section.actions[0].element, { text: 'New note', chord: () => host.chordOf('newNote') });
    ui.tooltip(section.actions[1].element, { text: 'New folder', chord: () => host.chordOf('newFolder') });
    // Delegated, so a row drawn again never loses a press.
    rows.element.addEventListener('click', (event) => {
        const row = entryAt(event.target);
        if (!row) return;
        host.show();
        const { kind, path } = entryOf(row);
        if (kind === 'note') return onOpenNote(path);
        if (row.hasAttribute('data-folds')) toggle(path);
        if (!event.target.closest('[data-caret]')) onOpenFolder(path);
    });
    ui.contextMenu(rows.element, {
        rowAt: entryAt,
        items: (row) => {
            if (!row) return null;
            const { kind, path, since } = entryOf(row);
            return kind === 'note' ? noteMenu(path, since, row) : folderMenu(path, since, row);
        },
    });
    ui.dragSource(rows.element, { itemAt: entryAt, describe: describeDrag });
    acceptDrops(
        element,
        ui.treeFolderAt({
            row: (under) => {
                const row = entryAt(under);
                if (!row) return null;
                const { kind, path } = entryOf(row);
                return { path, folder: kind === 'folder', element: row };
            },
            markOf: (folder) => rows.element.querySelector(`[data-folder="${CSS.escape(folder)}"]`),
            top: '',
            topMark: section.heading,
        })
    );

    return {
        element,
        draw,
        reveal,
        relocate: (from, to) => {
            expanded = new Set([...expanded].map((path) => movePath(path, from, to)).filter((path) => path != null));
            save();
        },
        labelOf: (path) => labelIn(rows.element, path),
    };

    function draw({ allNotes, place, openPath }) {
        section.setCurrent(place.kind === 'folder' && place.path === '');
        rows.set(itemsOf(allNotes, 0, { since: allNotes.since, place, openPath }));
    }

    // Opens the folders above `path`.
    function reveal(path) {
        let changed = false;
        for (let folder = parentOf(path); folder; folder = parentOf(folder)) {
            if (expanded.has(folder)) continue;
            expanded.add(folder);
            changed = true;
        }
        if (changed) save();
    }

    function toggle(path) {
        if (expanded.has(path)) expanded.delete(path);
        else expanded.add(path);
        save();
        onToggle();
    }

    function save() {
        store.set('expanded', [...expanded]);
    }

    function itemsOf(folder, depth, { since, place, openPath }) {
        return [
            ...folder.folders.flatMap((child) => {
                const open = expanded.has(child.path);
                const item = {
                    path: child.path,
                    kind: 'folder',
                    name: child.name,
                    depth,
                    open,
                    folds: child.folders.length + child.notes.length > 0,
                    active: place.kind === 'folder' && place.path === child.path,
                    since,
                };
                return [item, ...(open ? itemsOf(child, depth + 1, { since, place, openPath }) : [])];
            }),
            ...folder.notes.map((note) => ({
                path: note.path,
                kind: 'note',
                name: note.name,
                depth,
                open: false,
                folds: false,
                active: place.kind === 'note' && openPath === note.path,
                since,
            })),
        ];
    }

    function rowOf(item) {
        const isFolder = item.kind === 'folder';
        const row = ui.treeRow({
            depth: item.depth,
            folder: isFolder,
            folds: item.folds,
            open: item.open,
            glyph: noteGlyph,
            name: item.name || 'Untitled',
        });
        markEntry(row.element, item);
        row.element.title = item.path;
        row.setActive(item.active);
        return row.element;
    }
}
