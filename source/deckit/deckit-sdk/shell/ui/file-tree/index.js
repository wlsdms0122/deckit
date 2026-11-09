import * as ICON from '../icon/index.js';

// MARK: - Property
const STYLE = `
.deckit-tree-caret {
    display: flex;
    flex: 0 0 12px;
    justify-content: center;
    opacity: 0;
    transition: transform var(--deckit-fast) var(--deckit-easing);
}
.deckit-tree-row[data-folds] .deckit-tree-caret { opacity: 0.55; }
.deckit-tree-row[aria-expanded='true'] .deckit-tree-caret { transform: rotate(90deg); }
.deckit-tree-mark { display: flex; flex: 0 0 auto; }
.deckit-tree-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    `;
const DEPTH_INDENT = 14;

// MARK: - Initializer
// MARK: - Public
// A tree of files and folders: paths are "/"-separated, "" is the top of a relative tree and "/" the root of a
// disk.
function make(theme, ui) {
    const folderIcon = ({ open = false, size = 15 } = {}) =>
        ICON.icon(open ? 'folderOpen' : 'folder', { size, color: theme.color.folder });
    return {
        folderIcon,
        treeRow: (options) => treeRow(ui, folderIcon, options),
        folderDrop: (zone, options) => folderDrop(ui, zone, options),
        treeFolderAt,
        movesInto,
    };
}

// MARK: - Private
// A row of a tree: a caret when it folds, its mark, its name (marked `data-name`, what a rename types over).
// `setOpen` shows a row that folds open or folded.
function treeRow(
    ui,
    folderIcon,
    { depth = 0, folder = false, folds = folder, open = false, glyph = '', name = '', size = 'medium' } = {}
) {
    const row = ui.row({ size });
    const { element } = row;
    element.classList.add('deckit-tree-row');
    element.style.paddingLeft = 4 + depth * DEPTH_INDENT + 'px';
    element.toggleAttribute('data-folds', folds);
    const caret = document.createElement('span');
    caret.className = 'deckit-tree-caret';
    caret.dataset.caret = '';
    caret.innerHTML = ICON.icon('chevronRight', { size: 12 });
    const mark = document.createElement('span');
    mark.className = 'deckit-tree-mark';
    if (!folder) mark.innerHTML = glyph;
    const label = document.createElement('span');
    label.className = 'deckit-tree-name';
    label.dataset.name = '';
    label.textContent = name;
    element.append(caret, mark, label);
    const setOpen = (next) => {
        if (folds) element.setAttribute('aria-expanded', String(next));
        if (folder) mark.innerHTML = folderIcon({ open: next, size: size === 'small' ? 14 : 16 });
    };
    setOpen(open);
    return { ...row, setOpen };
}

// A drop target of moves into folders. `paths(payload)` are where the dragged things are, all in one folder;
// `folderAt(element)` is the folder under the pointer ({ folder, mark }). A drop into one of them, or into what
// one holds, is refused; a move into the folder they are already in is shown as staying.
function folderDrop(ui, zone, { kind, paths, folderAt, onDrop }) {
    return ui.dropTarget(zone, {
        kind,
        onDrop,
        placeAt: (under, payload) => {
            const place = folderAt(under);
            if (!place) return null;
            const froms = paths(payload);
            const into = place.folder;
            if (froms.some((from) => into === from || into.startsWith(from + '/'))) return null;
            if (froms.some((from) => movesInto(from, into))) return place;
            return froms.every((from) => parentOf(from) === into) ? { ...place, stays: true } : null;
        },
    });
}

// The folder under an element of a tree: the folder row itself, or the folder of a file row, or the top when it
// is on no row. `row(element)` finds the row ({ path, folder, element }); `markOf(folder)` the element that
// lights for it.
function treeFolderAt({ row, markOf, top, topMark }) {
    return (under) => {
        const found = row(under);
        if (!found) return { folder: top, mark: topMark };
        const folder = found.folder ? found.path : parentOf(found.path);
        return {
            folder,
            mark: folder === top ? topMark : found.folder ? found.element : markOf(folder) || found.element,
            row: found,
        };
    };
}

// Whether moving `from` into `folder` changes anything and is possible: not where it is, not into itself.
function movesInto(from, folder) {
    return parentOf(from) !== folder && folder !== from && !folder.startsWith(from + '/');
}

function parentOf(path) {
    const slash = path.lastIndexOf('/');
    return slash > 0 ? path.slice(0, slash) : slash === 0 ? '/' : '';
}

export { STYLE, make };
