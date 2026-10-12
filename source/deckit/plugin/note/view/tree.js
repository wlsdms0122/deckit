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
    const ROW = '[data-note], [data-folder]';
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
        const row = rowAt(event.target);
        if (!row) return;
        host.show();
        if (row.dataset.note) return onOpenNote(row.dataset.note);
        const path = row.dataset.folder;
        if (row.hasAttribute('data-folds')) toggle(path);
        if (!event.target.closest('[data-caret]')) onOpenFolder(path);
    });
    ui.contextMenu(rows.element, {
        rowAt,
        items: (row) =>
            !row
                ? null
                : row.dataset.note
                  ? noteMenu(row.dataset.note, Number(row.dataset.seq), row)
                  : folderMenu(row.dataset.folder, Number(row.dataset.seq), row),
    });
    ui.dragSource(rows.element, { itemAt: rowAt, describe: describeDrag });
    acceptDrops(
        element,
        ui.treeFolderAt({
            row: (under) => {
                const row = rowAt(under);
                return row
                    ? { path: row.dataset.note || row.dataset.folder, folder: !row.dataset.note, el: row }
                    : null;
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
        labelOf: (path) =>
            rows.element.querySelector(
                `[data-note="${CSS.escape(path)}"] [data-name], [data-folder="${CSS.escape(path)}"] [data-name]`
            ),
    };

    // `openNote` is the path of the note open, if any.
    function draw({ allNotes, place, openNote }) {
        section.setCurrent(place.kind === 'folder' && place.rel === '');
        rows.set(itemsOf(allNotes, 0, { since: allNotes.since, place, openNote }));
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

    function itemsOf(folder, depth, { since, place, openNote }) {
        return [
            ...folder.folders.flatMap((child) => {
                const open = expanded.has(child.rel);
                const item = {
                    path: child.rel,
                    kind: 'folder',
                    name: child.name,
                    depth,
                    open,
                    folds: child.folders.length + child.notes.length > 0,
                    active: place.kind === 'folder' && place.rel === child.rel,
                    since,
                };
                return [item, ...(open ? itemsOf(child, depth + 1, { since, place, openNote }) : [])];
            }),
            ...folder.notes.map((note) => ({
                path: note.rel,
                kind: 'note',
                name: note.name,
                depth,
                open: false,
                folds: false,
                active: place.kind === 'note' && openNote === note.rel,
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
        row.element.dataset[isFolder ? 'folder' : 'note'] = item.path;
        row.element.dataset.seq = String(item.since);
        row.element.title = item.path;
        row.setActive(item.active);
        return row.element;
    }

    // A drag can start on a text node, which has no closest().
    function rowAt(target) {
        return target.closest?.(ROW) ?? null;
    }
}
