const { fileIconOf } = require('../file-type/file-type.js');
const { parentOf, isInside, relativePath } = require('../path/path.js');

const TREE_STYLE = `
    .editor-tree { display: flex; flex-direction: column; flex: 1 0 auto; padding: 2px 0 8px; outline: none; }
    .editor-tree-empty { padding: 4px 8px; opacity: 0.4; font: 12.5px var(--deckit-font); }
`;

// A workspace's folder as a tree, read a folder at a time. The folders expanded are kept per folder in `store`. A row
// being renamed or dragged keeps its place until it is done.
function fileTree({ ui, store, fileSystem, isUnsaved, onOpen, onFindIn, onMove, onRename, menu }) {
    let root = null;
    const entriesByFolder = new Map(); // folder path -> its entries, once read
    let expanded = new Set();
    let selected = null;
    // A reveal still opening its folders leaves the selection alone once another selection was made.
    let selections = 0;

    // Grown to fill, so a drop or a right click under the rows is the top folder's.
    // A file and a folder at one path are two rows: one turning into the other is drawn again.
    const rows = ui.list({ key: (item) => keyOf(item.path, item.folder), create: rowOf, update: updateRow });
    const rowParts = new WeakMap(); // row element -> { setActive, setOpen, unsaved }
    const element = rows.element;
    element.classList.add('editor-tree');

    ui.contextMenu(element, {
        rowAt: (target) => target.closest?.('[data-path]') || null,
        items: (row) => {
            if (!root) return null;
            if (!row) return menu(null);
            const entry = entryAt(row.dataset.path);
            return entry ? menu(entry) : null;
        },
    });
    ui.tree(element, {
        items: () => [...element.querySelectorAll('[data-path]')].map((row) => row.dataset.path),
        // A selected entry since gone from the disk is no lead.
        lead: () => (selected && entryAt(selected) ? selected : null),
        nameOf: (path) => entryAt(path).name,
        expanded: (path) => (entryAt(path).folder ? expanded.has(path) : null),
        parentOf: (path) => (isInside(parentOf(path), root) ? parentOf(path) : null),
        childrenOf: (path) => (entriesByFolder.get(path) || []).map((entry) => entry.path),
        onSelect: moveTo,
        onToggle: setExpanded,
        // A folder shows what it holds; a file is previewed, as moving onto it does.
        onPreview: (path) => {
            if (entryAt(path).folder) setExpanded(path, !expanded.has(path));
            else onOpen(path, { preview: true, preserveFocus: true });
        },
        onRename: (path) => onRename(entryAt(path)),
        onOpen: (path) => {
            if (entryAt(path).folder) setExpanded(path, true);
            else onOpen(path, { preview: false });
        },
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
        paths: (held) => [held.path],
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
        const shown = rowAt(path);
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
        const row = rowAt(path);
        if (row && !ui.isFullyVisible(row)) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // The folder is read again first: the entry may be new.
    async function nameAt(path) {
        await readFolder(parentOf(path));
        await reveal(path);
        return rowAt(path)?.querySelector('[data-name]') || null;
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
        const {
            element: row,
            setActive,
            setOpen,
        } = ui.treeRow({
            depth: item.depth,
            folder: item.folder,
            open: item.open,
            glyph: item.folder ? '' : fileIconOf(ui, item.name, 14),
            name: item.name,
            size: 'small',
        });
        row.title = item.path;
        row.dataset.path = item.path;
        const unsaved = ui.element('span', { className: 'editor-unsaved-dot' });
        row.append(unsaved);
        if (item.folder) {
            const find = ui.rowAction({
                icon: ui.icon('search', { size: 13 }),
                title: 'Find in this folder',
                onClick: () => onFindIn(relativePath(item.path, root)),
            }).element;
            // The tree is one stop of Tab; a row's action is reached by the pointer.
            find.tabIndex = -1;
            row.append(find);
        }
        rowParts.set(row, { setActive, setOpen, unsaved });
        updateRow(row, item);
        row.addEventListener('click', () => {
            if (!item.folder) return moveTo(item.path);
            select(item.path);
            setExpanded(item.path, !expanded.has(item.path));
        });
        if (!item.folder) row.addEventListener('dblclick', () => onOpen(item.path, { preview: false }));
        return row;
    }

    // What changes of a row in place, so the one under the pointer stays the same element.
    function updateRow(row, item) {
        const parts = rowParts.get(row);
        if (!parts) return;
        parts.setActive(item.selected);
        parts.setOpen(item.open);
        parts.unsaved.hidden = !item.unsaved;
    }

    function keyOf(path, folder) {
        return (folder ? 'folder:' : 'file:') + path;
    }

    function rowAt(path) {
        return rows.elementOf(keyOf(path, false)) || rows.elementOf(keyOf(path, true));
    }

    function folderUnder(under) {
        return ui.treeFolderAt({
            row: (target) => {
                const row = target.closest?.('[data-path]');
                const entry = row && entryAt(row.dataset.path);
                return entry ? { path: entry.path, folder: entry.folder, element: row } : null;
            },
            markOf: (folder) => rows.elementOf(keyOf(folder, true)),
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
        rowAt(path)?.scrollIntoView({ block: 'nearest' });
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
            entriesByFolder.set(folder, await fileSystem.list(folder));
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

module.exports = { TREE_STYLE, fileTree };
