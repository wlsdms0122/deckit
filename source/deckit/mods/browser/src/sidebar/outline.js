const { isFolder, folderLabel } = require('../tree/tree.js');

// Each folder colour as it reads on a dark ground and on a light one. A colour picked by the person is a hex, worn on
// both.
const FOLDER_INKS = {
    blue: ['#8ab4f8', '#1a73e8'],
    red: ['#f28b82', '#d93025'],
    yellow: ['#fdd663', '#e37400'],
    green: ['#81c995', '#1e8e3e'],
    pink: ['#ff8bcb', '#d01884'],
    purple: ['#c58af9', '#9334e6'],
    cyan: ['#78d9ec', '#007b83'],
    orange: ['#fcad70', '#fa7b17'],
    grey: ['#bdc1c6', '#5f6368'],
};

// A tree (`tree.js`) drawn as the rows of a list, as an outline view draws one: a folder's row, then its children's a
// level in, which a folded folder leaves out. A row is moved by a drag, between two rows at the depth it is drawn
// sideways to, or into a folded or empty folder it is let go on; a folder takes its rows with it. Drawn out of the
// list, a row is carried as `describe(node)` says. A folder's row is drawn here and an item's by `createItem` and
// `updateItem`; both are painted here with their depth, and a folder's in its colour.
//
// The keys walk the rows as macOS walks an outline (the kit's `tree`). The row they stand on is the lead. With
// `choose(item)`, leading an item chooses it (a tab brought to the front), so the lead is the chosen item; any other
// row is marked as chosen while it leads. `nameOf(item)` is what type-ahead matches; `onRename(node)` and
// `onOpen(node)` are what Return and Control-Return do to the lead, but Control-Return on a folded folder unfolds it.
function outline({ ui, describe, createItem, updateItem, nameOf, choose = null, onRename, onOpen, onPlace, onToggle }) {
    // How far a folder's children stand in from it, which puts a child's icon under the folder's: a drag sideways by
    // as much moves a row a level in or out.
    const INDENT = 22;

    let shownTree = null;
    let shownRows = [];
    let chosen = null; // the item chosen, as the caller last set it
    let leadKey = null; // the row the keys stand on, when it is not the chosen item's
    const folderRows = new WeakMap(); // row element -> { row, glyph, label, count }

    // A folder's own row is washed in its colour, and the rows in it are drawn plain, as rows outside a folder are.
    // The hover and the mark of the row chosen are drawn over the colour, as they are over none.
    ui.addStyle(`
        .browser-row-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .browser-outline-row.browser-folder {
            --browser-folder-tint: light-dark(
                color-mix(in srgb, var(--browser-folder-ink) 14%, transparent),
                color-mix(in srgb, var(--browser-folder-ink) 18%, transparent)
            );
            background: var(--browser-folder-tint);
        }
        .browser-outline-row.browser-folder:hover {
            background: linear-gradient(var(--deckit-hover), var(--deckit-hover)), var(--browser-folder-tint);
        }
        .browser-outline-row.browser-folder[data-active] {
            background: linear-gradient(var(--deckit-selected), var(--deckit-selected)), var(--browser-folder-tint);
        }
        .browser-folder-caret {
            display: flex;
            flex: 0 0 auto;
            color: var(--browser-folder-ink);
            transition: transform var(--deckit-fast) var(--deckit-easing);
        }
        .browser-folder[aria-expanded='true'] .browser-folder-caret { transform: rotate(90deg); }
        .browser-folder[data-empty] .browser-folder-caret { visibility: hidden; }
        .browser-folder-glyph { display: flex; flex: 0 0 auto; color: var(--browser-folder-ink); }
        .browser-folder-label { color: var(--browser-folder-ink); font-weight: 600; }
        .browser-folder-count { flex: 0 0 auto; color: var(--browser-folder-ink); font: var(--deckit-type-small); opacity: 0.8; }
    `);
    const list = ui.list({
        key: keyOf,
        create: (row) => paint(isFolder(row.node) ? folderRow(row) : createItem(row), row),
        update: (element, row) => {
            if (isFolder(row.node)) updateFolderRow(element, row);
            else updateItem(element, row);
            paint(element, row);
        },
        animated: true,
    });
    ui.sortable(list, {
        depth: {
            indent: INDENT,
            project: depthAt,
            descendants: (key) => descendantsOf(rowOf(key)).map(keyOf),
        },
        movesInto: (key, toKey) => takesDrop(rowOf(toKey).node),
        onMoveInto: (key, toKey) => {
            const folder = rowOf(toKey).node;
            onPlace(rowOf(key).node, folder, folder.children.length);
        },
        onReorder: (key, toKey, depth) => {
            const { parent, index } = placeAt(key, toKey, depth);
            onPlace(rowOf(key).node, parent, index);
        },
        describe: (key) => describe(rowOf(key).node),
    });
    ui.tree(list.element, {
        items: () => shownRows.map(keyOf),
        lead: () => {
            const marked = shownRows.find((row) => row.active);
            return marked ? keyOf(marked) : null;
        },
        nameOf: (key) => {
            const { node } = rowOf(key);
            return isFolder(node) ? folderLabel(node) : nameOf(node);
        },
        expanded: (key) => {
            const { node } = rowOf(key);
            return isFolder(node) && node.children.length ? !node.collapsed : null;
        },
        parentOf: (key) => {
            const folder = rowOf(key).ancestors.at(-1);
            return folder ? folder.id : null;
        },
        childrenOf: (key) => rowOf(key).node.children.map((node) => node.id),
        onSelect: lead,
        onToggle: (key, open) => {
            const folder = rowOf(key).node;
            if (folder.collapsed === open) onToggle(folder);
        },
        onRename: (key) => onRename(rowOf(key).node),
        onOpen: (key) => {
            const { node } = rowOf(key);
            if (!isFolder(node)) return onOpen(node);
            if (node.collapsed && node.children.length) onToggle(node);
        },
    });
    // The lead is marked while the keys are here: with the focus gone, the chosen item is marked again. Where the
    // focus went is read once the move is over: a rename field taken away loses it before giving it back to the list.
    list.element.addEventListener('focusout', () => {
        if (!leadKey) return;
        queueMicrotask(() => {
            if (!leadKey || list.element.contains(document.activeElement)) return;
            leadKey = null;
            draw();
        });
    });
    // A press leads from its row, as the keys do.
    list.element.addEventListener('click', (event) => {
        const element = event.target.closest('.browser-outline-row');
        const key = element && list.keyOf(element);
        if (key && rowOf(key)) lead(key, { pressed: true });
    });

    return {
        element: list.element,
        // `active` is the item chosen: its row is marked, or the row of the folded folder it is in.
        // A new chosen item is where the keys stand from then on.
        set(tree, active = null) {
            if (active !== chosen) leadKey = null;
            shownTree = tree;
            chosen = active;
            draw();
        },
        // `node`'s name typed over its row, the folders it is in unfolded to show it: `onCommit(name)` takes the
        // name, as the kit's `inlineEdit` has it. Resolves whether it renamed.
        rename(node, onCommit) {
            for (const folder of shownTree.ancestorsOf(node)) if (folder.collapsed) onToggle(folder);
            return ui.inlineEdit(list.elementOf(node.id).querySelector('.browser-row-label'), { onCommit });
        },
        // The node of the row `target` is in, or null.
        nodeAt(target) {
            const element = target.closest('.browser-outline-row');
            const key = element && list.keyOf(element);
            return key ? rowOf(key).node : null;
        },
        // Where a thing dropped on `target` from elsewhere goes, at the end: into the folder whose row it is on, or
        // the folder of the item whose row it is on, or off the rows the top level. `mark` is that folder's row, or
        // null for the top level.
        dropAt(target) {
            const element = target.closest('.browser-outline-row');
            const key = element && list.keyOf(element);
            const { node, ancestors } = key ? rowOf(key) : { node: null, ancestors: [] };
            if (node && isFolder(node)) return { parent: node, mark: element };
            const folder = ancestors.at(-1);
            if (!folder) return { parent: shownTree.root, mark: null };
            return { parent: folder, mark: list.elementOf(folder.id) };
        },
    };

    // A lead whose row is no longer shown (taken away, or in a folder folded) gives way to the chosen item.
    function draw() {
        shownRows = rowsOf(shownTree, chosen);
        if (leadKey && !shownRows.some((row) => keyOf(row) === leadKey)) {
            leadKey = null;
            shownRows = rowsOf(shownTree, chosen);
        }
        list.set(shownRows);
    }

    // The keys stand on `key`. An item the caller chooses becomes the chosen one, which the caller draws; a press has
    // already chosen what it pressed.
    function lead(key, { pressed = false } = {}) {
        const { node } = rowOf(key);
        if (choose && !isFolder(node)) {
            leadKey = null;
            if (!pressed) choose(node);
            return;
        }
        leadKey = key;
        draw();
    }

    // Each row's depth, the folders it is in (outermost first) and the items a folder holds at any depth. The lead,
    // when it is not the chosen item, is marked as chosen instead.
    function rowsOf(tree, active) {
        const rows = [];
        const visit = (children, ancestors) => {
            for (const node of children) {
                const folded = isFolder(node) && node.collapsed;
                const row = {
                    node,
                    depth: ancestors.length,
                    ancestors,
                    size: isFolder(node) ? tree.items(node).length : 0,
                };
                row.active = leadKey
                    ? keyOf(row) === leadKey
                    : node === active || (folded && !!active && tree.contains(node, active));
                rows.push(row);
                if (isFolder(node) && !node.collapsed) visit(node.children, [...ancestors, node]);
            }
        };
        visit(tree.root.children, []);
        return rows;
    }

    // No two nodes of a tree share an id.
    function keyOf(row) {
        return row.node.id;
    }

    function rowOf(key) {
        return shownRows.find((row) => keyOf(row) === key);
    }

    // The rows under a folder's, as far as they go deeper than it.
    function descendantsOf(row) {
        const at = shownRows.indexOf(row);
        const end = shownRows.findIndex((each, index) => index > at && each.depth <= row.depth);
        return shownRows.slice(at + 1, end < 0 ? shownRows.length : end);
    }

    // The rows a row would stand between, let go where `toKey` is, with the rows that go with it put away:
    // { before, after }, either missing at an end.
    function between(key, toKey) {
        const moving = rowOf(key);
        const carried = new Set(descendantsOf(moving));
        const rows = shownRows.filter((row) => !carried.has(row));
        const rest = rows.filter((row) => row !== moving);
        const to = rows.findIndex((row) => keyOf(row) === toKey);
        return { before: rest[to - 1] || null, after: rest[to] || null };
    }

    // A row's depth there: as deep as a child of the row before it when that one takes children, else no deeper than
    // it, and no shallower than the row after it, which would leave its folder otherwise.
    function depthAt(key, toKey, levels) {
        const { before, after } = between(key, toKey);
        const deepest = before ? before.depth + (takesChild(before.node) ? 1 : 0) : 0;
        const shallowest = after ? after.depth : 0;
        return Math.min(deepest, Math.max(shallowest, rowOf(key).depth + levels));
    }

    // Where a row let go where `toKey` is, at `depth`, goes: `{ parent, index }`, the index read with it still where
    // it was.
    function placeAt(key, toKey, depth) {
        const { before } = between(key, toKey);
        if (!before) return { parent: shownTree.root, index: 0 };
        if (depth > before.depth) return { parent: before.node, index: 0 };
        const sibling = depth === before.depth ? before.node : before.ancestors[depth];
        const parent = depth ? before.ancestors[depth - 1] : shownTree.root;
        return { parent, index: parent.children.indexOf(sibling) + 1 };
    }

    // An open folder takes a row let go under it as its first; an empty one, open or folded, too.
    function takesChild(node) {
        return isFolder(node) && (!node.collapsed || !node.children.length);
    }

    // A folder whose rows are not shown takes a row let go on it, at its end.
    function takesDrop(node) {
        return isFolder(node) && (node.collapsed || !node.children.length);
    }

    function folderRow(shown) {
        const row = ui.row();
        row.element.classList.add('browser-outline-row', 'browser-folder');
        const caret = ui.element('span', { className: 'browser-folder-caret' });
        caret.innerHTML = ui.icon('chevronRight', { size: 14 });
        const glyph = ui.element('span', { className: 'browser-folder-glyph' });
        const label = ui.element('span', { className: 'browser-row-label browser-folder-label' });
        const count = ui.element('span', { className: 'browser-folder-count' });
        row.element.append(caret, glyph, label, count);
        row.element.addEventListener('click', () => {
            const folder = rowOf(list.keyOf(row.element)).node;
            if (folder.children.length) onToggle(folder);
        });
        folderRows.set(row.element, { row, glyph, label, count });
        updateFolderRow(row.element, shown);
        return row.element;
    }

    // An empty folder has nothing to fold, so no caret. A folded one shows how many items it holds.
    function updateFolderRow(element, { node, size, active }) {
        const { row, glyph, label, count } = folderRows.get(element);
        const empty = !node.children.length;
        const open = !empty && !node.collapsed;
        element.toggleAttribute('data-empty', empty);
        element.toggleAttribute('data-collapsed', !empty && node.collapsed);
        if (empty) element.removeAttribute('aria-expanded');
        else element.setAttribute('aria-expanded', String(open));
        element.title = empty ? '' : open ? 'Collapse folder' : 'Expand folder';
        glyph.innerHTML = ui.icon(open ? 'folderOpen' : 'folder', { size: 16 });
        label.textContent = folderLabel(node);
        count.textContent = node.collapsed && size ? String(size) : '';
        row.setActive(active);
    }

    // An item stands in by its padding, over the row's whole width; a folder's row starts at its depth, so its colour
    // does too.
    function paint(element, { node, depth }) {
        element.classList.add('browser-outline-row');
        element.dataset.depth = depth;
        const folder = isFolder(node);
        element.style.marginLeft = folder ? depth * INDENT + 'px' : '';
        element.style.width = folder ? `calc(100% - ${depth * INDENT}px)` : '';
        element.style.paddingLeft = 8 + (folder ? 0 : depth * INDENT) + 'px';
        if (folder) element.style.setProperty('--browser-folder-ink', inkOf(node.color));
        return element;
    }
}

// A folder colour as the page's color scheme draws it, so a new theme repaints it in place.
function inkOf(color) {
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    const [dark, light] = FOLDER_INKS[color] || FOLDER_INKS.grey;
    return `light-dark(${light}, ${dark})`;
}

module.exports = { outline, inkOf };
