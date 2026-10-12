const TREE_STYLE = `
    .deckit-list.editor-tree { display: flex; flex-direction: column; flex: 1 0 auto; padding: 2px 0 8px; outline: none; }
    .editor-tree-unsaved {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.7;
    }
    .editor-tree-empty { padding: 4px 8px; opacity: 0.4; font: 12.5px var(--deckit-font); }
`;

// A workspace's folder as a tree, read a folder at a time. The folders expanded are kept per folder in `store`. A row
// being renamed or dragged keeps its place until it is done.
function fileTree({ ui, store, main, isUnsaved, onOpen, onFindIn, onMove, menu }) {
    let root = null;
    const entriesByFolder = new Map(); // folder path -> its entries, once read
    let expanded = new Set();
    let selected = null;
    // A reveal still opening its folders leaves the selection alone once another selection was made.
    let selections = 0;

    // Grown to fill, so a drop or a right click under the rows is the top folder's.
    const rows = ui.list({ key: (item) => item.path, create: rowOf });
    const element = rows.element;
    element.classList.add('editor-tree');
    element.tabIndex = -1;

    ui.contextMenu(element, {
        rowAt: (target) => target.closest?.('[data-path]') || null,
        items: (row) => {
            if (!root) return null;
            if (!row) return menu(null);
            const entry = entryAt(row.dataset.path);
            return entry ? menu(entry) : null;
        },
    });
    // Only on the tree itself: a name being typed over in a row keeps its keys.
    element.addEventListener('keydown', (event) => {
        if (event.target !== element || event.metaKey || event.ctrlKey || event.altKey || !root) return;
        const entry = selected && entryAt(selected);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const paths = [...element.querySelectorAll('[data-path]')].map((row) => row.dataset.path);
            const index = paths.indexOf(selected);
            const by = event.key === 'ArrowDown' ? 1 : -1;
            const next = index < 0 ? paths[0] : paths[Math.min(paths.length - 1, Math.max(0, index + by))];
            if (next && next !== selected) moveTo(next);
        } else if (event.key === 'ArrowRight' && entry?.folder) {
            event.preventDefault();
            if (!expanded.has(entry.path)) return setExpanded(entry.path, true);
            const first = entriesByFolder.get(entry.path)?.[0];
            if (first) moveTo(first.path);
        } else if (event.key === 'ArrowLeft' && entry) {
            event.preventDefault();
            if (entry.folder && expanded.has(entry.path)) return setExpanded(entry.path, false);
            const up = parentOf(entry.path);
            if (isInside(up, root)) moveTo(up);
        } else if (event.key === ' ' && entry?.folder) {
            // The sidebar does not scroll by a page.
            event.preventDefault();
            setExpanded(entry.path, !expanded.has(entry.path));
        }
    });
    ui.dragSource(element, {
        itemAt: (target) => target.closest?.('[data-path]') || null,
        describe: (row) => {
            const entry = entryAt(row.dataset.path);
            if (!entry) return null;
            const icon = entry.folder ? ui.folderIcon({ open: false, size: 14 }) : fileIconOf(ui, entry.name, 14);
            return { kind: 'editor-entry', payload: entry, text: entry.name, icon };
        },
    });
    ui.folderDrop(element, {
        kind: 'editor-entry',
        path: (held) => held.path,
        folderAt: (under) => root && folderUnder(under),
        onDrop: (held, place) => onMove(held, place.folder),
    });

    return {
        element,
        setRoot,
        refresh,
        repaint: draw,
        reveal,
        focus: () => element.focus({ preventScroll: true }),
        picked: () => (element.contains(document.activeElement) && selected ? entryAt(selected) : null),
        nameAt,
        follow,
    };

    async function setRoot(path) {
        root = path;
        entriesByFolder.clear();
        selected = null;
        expanded = new Set(store.get(expandedKey(), []));
        await refresh();
    }

    async function refresh() {
        if (!root) return;
        const open = [root, ...[...expanded].filter((path) => isInside(path, root))];
        await Promise.all(open.map(readFolder));
        draw();
    }

    // Scrolled to the middle only when out of sight: a row the eye can already see is found where it is.
    async function reveal(path) {
        if (!root || !isInside(path, root)) return;
        const turn = ++selections;
        const shown = rows.elementOf(path);
        if (selected === path && shown && ui.isFullyVisible(shown)) return;
        let folder = root;
        for (const part of relativePath(path, root).split('/').slice(0, -1)) {
            folder = folder + '/' + part;
            await expand(folder);
        }
        if (turn !== selections) return draw();
        selected = path;
        saveExpanded();
        draw();
        const row = rows.elementOf(path);
        if (row && !ui.isFullyVisible(row)) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // The folder is read again first: the entry may be new.
    async function nameAt(path) {
        await readFolder(parentOf(path));
        await reveal(path);
        return rows.elementOf(path)?.querySelector('[data-name]') || null;
    }

    function follow(move) {
        const next = root && move(root);
        expanded = new Set([...expanded].map(move).filter(Boolean));
        selected = selected && move(selected);
        if (next && next !== root) {
            store.remove(expandedKey());
            root = next;
            entriesByFolder.clear();
        }
        saveExpanded();
        return refresh();
    }

    function draw() {
        if (!root) return rows.set([]);
        const items = [];
        const walk = (folder, depth) => {
            for (const entry of entriesByFolder.get(folder) || []) {
                const open = entry.folder && expanded.has(entry.path);
                items.push({
                    path: entry.path,
                    name: entry.name,
                    folder: entry.folder,
                    depth,
                    open,
                    unsaved: isUnsaved(entry),
                    selected: entry.path === selected,
                });
                if (open) walk(entry.path, depth + 1);
            }
        };
        walk(root, 0);
        if (!(entriesByFolder.get(root) || []).length) items.push({ path: '', empty: true });
        rows.set(items);
    }

    function rowOf(item) {
        if (item.empty) return ui.element('div', { className: 'editor-tree-empty', text: 'Empty folder' });
        const { element: row, setActive } = ui.treeRow({
            depth: item.depth,
            folder: item.folder,
            open: item.open,
            glyph: item.folder ? '' : fileIconOf(ui, item.name, 14),
            name: item.name,
            size: 'small',
        });
        row.title = item.path;
        row.dataset.path = item.path;
        if (item.unsaved) row.append(ui.element('span', { className: 'editor-tree-unsaved' }));
        if (item.folder)
            row.append(
                ui.rowAction({
                    icon: ui.icon('search', { size: 13 }),
                    title: 'Find in this folder',
                    onClick: () => onFindIn(relativePath(item.path, root)),
                }).element
            );
        setActive(item.selected);
        row.addEventListener('click', () => {
            element.focus({ preventScroll: true });
            if (!item.folder) return moveTo(item.path);
            select(item.path);
            setExpanded(item.path, !expanded.has(item.path));
        });
        if (!item.folder) row.addEventListener('dblclick', () => onOpen(item.path, { preview: false }));
        return row;
    }

    function folderUnder(under) {
        return ui.treeFolderAt({
            row: (target) => {
                const row = target.closest?.('[data-path]');
                const entry = row && entryAt(row.dataset.path);
                return entry ? { path: entry.path, folder: entry.folder, el: row } : null;
            },
            markOf: (folder) => rows.elementOf(folder),
            top: root,
            topMark: element,
        })(under);
    }

    function select(path) {
        selections++;
        selected = path;
    }

    // Selected, and a file previewed without the focus, which stays here for the next key.
    function moveTo(path) {
        select(path);
        const entry = entryAt(path);
        if (entry && !entry.folder) onOpen(path, { preview: true, preserveFocus: true });
        draw();
        rows.elementOf(path)?.scrollIntoView({ block: 'nearest' });
    }

    async function setExpanded(folder, open) {
        if (open) await expand(folder);
        else expanded.delete(folder);
        saveExpanded();
        draw();
    }

    // Read again each time: what it held may have changed.
    async function expand(folder) {
        expanded.add(folder);
        await readFolder(folder);
    }

    async function readFolder(folder) {
        try {
            entriesByFolder.set(folder, await main.call('list', folder));
        } catch (error) {
            entriesByFolder.set(folder, []);
            if (error.kind === 'GONE' && expanded.delete(folder)) saveExpanded();
        }
    }

    function entryAt(path) {
        for (const entries of entriesByFolder.values()) {
            const entry = entries.find((candidate) => candidate.path === path);
            if (entry) return entry;
        }
        return null;
    }

    function expandedKey() {
        return 'expanded:' + root;
    }

    function saveExpanded() {
        store.set(expandedKey(), [...expanded]);
    }
}
