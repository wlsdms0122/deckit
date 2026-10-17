// What a folder is coloured, in the order a new folder takes the first one no folder in its tree has.
const FOLDER_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// The one shape the open tabs and the bookmarks are kept in: a list of nodes, each a folder or an item. A folder is
// `{ id, title, color, collapsed, children }`, its children nodes in order; an item (a tab, a bookmark) has no
// `children`. `color` is one of FOLDER_COLORS, or a hex the person picked. Ids are unique in a tree, and a new one is
// past every id it has held and past `lastId`, so an id kept elsewhere never finds a newer node.
function tree(children, lastId = 0) {
    const root = { children };
    for (const { node } of walk()) lastId = Math.max(lastId, node.id);

    return { root, walk, items, folders, find, parentOf, ancestorsOf, contains, insert, remove, move, folder, newId };

    // Every node, depth first, with its depth and the folders it is in, outermost first.
    function walk(from = root) {
        const found = [];
        const visit = (nodes, ancestors) => {
            for (const node of nodes) {
                found.push({ node, depth: ancestors.length, ancestors });
                if (isFolder(node)) visit(node.children, [...ancestors, node]);
            }
        };
        visit(from.children, []);
        return found;
    }

    function items(from = root) {
        return walk(from)
            .map(({ node }) => node)
            .filter((node) => !isFolder(node));
    }

    function folders() {
        return walk()
            .map(({ node }) => node)
            .filter(isFolder);
    }

    function find(id) {
        return walk().find(({ node }) => node.id === id)?.node || null;
    }

    // The folder `node` is in, or the root.
    function parentOf(node) {
        return [root, ...folders()].find((folder) => folder.children.includes(node));
    }

    // The folders `node` is in, from its own outwards.
    function ancestorsOf(node) {
        const found = [];
        for (let folder = parentOf(node); folder !== root; folder = parentOf(folder)) found.push(folder);
        return found;
    }

    // Whether `node` is in `folder`, at any depth.
    function contains(folder, node) {
        return walk(folder).some((each) => each.node === node);
    }

    function insert(node, parent = root, index = parent.children.length) {
        parent.children.splice(index, 0, node);
        const added = isFolder(node) ? [node, ...walk(node).map((each) => each.node)] : [node];
        for (const each of added) lastId = Math.max(lastId, each.id);
    }

    // Answers where it was: `{ parent, index }`.
    function remove(node) {
        const parent = parentOf(node);
        const index = parent.children.indexOf(node);
        parent.children.splice(index, 1);
        return { parent, index };
    }

    // `index` is read with the node still where it was.
    function move(node, parent, index) {
        const from = remove(node);
        insert(node, parent, from.parent === parent && from.index < index ? index - 1 : index);
    }

    // A new folder, not yet in the tree.
    function folder(title = '') {
        const all = folders();
        const used = new Set(all.map((each) => each.color));
        const color = FOLDER_COLORS.find((each) => !used.has(each)) || FOLDER_COLORS[all.length % FOLDER_COLORS.length];
        return { id: newId(), title, color, collapsed: false, children: [] };
    }

    function newId() {
        return ++lastId;
    }
}

function isFolder(node) {
    return Array.isArray(node.children);
}

module.exports = { FOLDER_COLORS, tree, isFolder };
