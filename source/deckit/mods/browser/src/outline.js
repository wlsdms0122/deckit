const { isFolder } = require('./tree.js');

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
// sideways to, or into a folded or empty folder it is let go on; a folder takes its rows with it. A folder's row is
// drawn here and an item's by `createItem` and `updateItem`; both are painted here with their depth and the colours
// of the folders they are in.
function outline({ ui, createItem, updateItem, onPlace, onToggle }) {
    // How far a folder's children stand in from it, which puts a child's icon under the folder's: a drag sideways by
    // as much moves a row a level in or out.
    const INDENT = 22;

    let shownTree = null;
    let shownRows = [];
    const folderRows = new WeakMap(); // row element -> { row, glyph, label, count }

    // A folder and what it holds are one block in its colour, and a folder in a folder a block in that one: each
    // folder's colour runs from its own depth to the next folder's. The hover and the mark of the row chosen are drawn
    // over the colours, as they are over none.
    ui.addStyle(`
        .browser-row-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .browser-outline-row[data-tinted] {
            border-radius: 0;
            background-color: transparent;
            background-image: var(--browser-tint);
        }
        .browser-outline-row[data-tinted]:hover {
            background-image: linear-gradient(var(--deckit-hover), var(--deckit-hover)), var(--browser-tint);
        }
        .browser-outline-row[data-tinted][data-active] {
            background-image: linear-gradient(var(--deckit-selected), var(--deckit-selected)), var(--browser-tint);
        }
        .browser-outline-row[data-block-start] {
            border-top-left-radius: var(--deckit-radius-control);
            border-top-right-radius: var(--deckit-radius-control);
        }
        .browser-outline-row[data-block-end] {
            border-bottom-left-radius: var(--deckit-radius-control);
            border-bottom-right-radius: var(--deckit-radius-control);
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
        .browser-folder[data-empty] .browser-folder-count { color: var(--deckit-muted); opacity: 1; }
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
            project: (key, toKey, levels) => depthAt(key, toKey, levels),
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
    });

    return {
        element: list.element,
        // `active` is the item chosen: its row is marked, or the row of the folded folder it is in.
        set(tree, active = null) {
            shownTree = tree;
            shownRows = rowsOf(tree, active);
            list.set(shownRows);
        },
        // The node of the row `target` is in, or null.
        nodeAt(target) {
            const element = target.closest('.browser-outline-row');
            const key = element && list.keyOf(element);
            return key ? rowOf(key).node : null;
        },
    };

    // Each row's depth, the folders it is in (outermost first), the items a folder holds at any depth, and whether it
    // starts or ends a block of colour.
    function rowsOf(tree, active) {
        const rows = [];
        const visit = (children, ancestors) => {
            for (const node of children) {
                const folded = isFolder(node) && node.collapsed;
                rows.push({
                    node,
                    depth: ancestors.length,
                    ancestors,
                    size: isFolder(node) ? tree.items(node).length : 0,
                    active: node === active || (folded && !!active && tree.contains(node, active)),
                });
                if (isFolder(node) && !node.collapsed) visit(node.children, [...ancestors, node]);
            }
        };
        visit(tree.root.children, []);
        rows.forEach((row, index) => {
            const tinted = isFolder(row.node) || row.ancestors.length > 0;
            row.start = isFolder(row.node) && row.depth === 0;
            row.end = tinted && (rows[index + 1]?.depth ?? 0) === 0;
        });
        return rows;
    }

    function keyOf(row) {
        return (isFolder(row.node) ? 'folder:' : 'item:') + row.node.id;
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

    // An empty folder has nothing to fold: no caret, and "Empty" where a folded one shows how many items it holds.
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
        label.textContent = node.title || 'Untitled Folder';
        count.textContent = empty ? 'Empty' : node.collapsed && size ? String(size) : '';
        row.setActive(active);
    }

    function paint(element, { node, depth, ancestors, start, end }) {
        const blocks = isFolder(node) ? [...ancestors, node] : ancestors;
        element.classList.add('browser-outline-row');
        element.dataset.depth = depth;
        element.style.paddingLeft = 8 + depth * INDENT + 'px';
        element.toggleAttribute('data-tinted', blocks.length > 0);
        element.toggleAttribute('data-block-start', start);
        element.toggleAttribute('data-block-end', end);
        element.style.setProperty('--browser-tint', blocks.length ? tintOf(blocks) : 'none');
        if (isFolder(node)) element.style.setProperty('--browser-folder-ink', inkOf(node.color));
        return element;
    }

    // Each folder's colour from its own depth to the next one's, the innermost to the row's end.
    function tintOf(blocks) {
        const stops = blocks.map((folder, level) => {
            const ink = inkOf(folder.color);
            const tint = `light-dark(color-mix(in srgb, ${ink} 14%, transparent), color-mix(in srgb, ${ink} 18%, transparent))`;
            const to = level === blocks.length - 1 ? '100%' : (level + 1) * INDENT + 'px';
            return `${tint} ${level * INDENT}px ${to}`;
        });
        return `linear-gradient(to right, ${stops.join(', ')})`;
    }
}

// A folder colour as the page's color scheme draws it, so a new theme repaints it in place.
function inkOf(color) {
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    const [dark, light] = FOLDER_INKS[color] || FOLDER_INKS.grey;
    return `light-dark(${light}, ${dark})`;
}

module.exports = { outline, inkOf };
