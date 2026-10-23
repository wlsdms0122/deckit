const { fileTypeOf, fileIconOf } = require('../file-type/file-type.js');
const { iconElement } = require('../icon-element/icon-element.js');
const { nameOf, isInside, relativePath } = require('../path/path.js');

const PATH_BAR_STYLE = `
    .editor-path-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 auto;
        height: 28px;
        padding: 0 12px;
        border-top: var(--deckit-border);
        border-bottom: var(--deckit-border);
        background: var(--deckit-surface);
        font: 12px var(--deckit-font);
        white-space: nowrap;
        overflow: hidden;
    }
    .editor-path-bar[hidden] { display: none; }
    .editor-path-bar .editor-crumbs { display: flex; align-items: center; gap: 4px; flex: 1 1 auto; min-width: 0; overflow: hidden; }
    .editor-crumb-separator { opacity: 0.35; flex: 0 0 auto; }
    .editor-crumb { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; min-width: 0; opacity: 0.6; }
    .editor-crumb[data-last] { flex: 0 1 auto; opacity: 1; }
    .editor-crumb[data-revealable] { cursor: pointer; }
    .editor-crumb-icon { display: flex; }
    .editor-crumb-label { overflow: hidden; text-overflow: ellipsis; }
    .editor-cursor-position { flex: 0 0 auto; opacity: 0.5; font-variant-numeric: tabular-nums; }
`;

// Above the open file: where it is, from its workspace's folder, and where the cursor is. A folder of the path reveals
// the file in the workspace's tree.
function filePathBar({ ui, util, onReveal }) {
    const element = ui.element('div', { className: 'editor-path-bar' });
    const crumbs = ui.list({ key: (item) => item.key, create: crumbOf });
    const cursorPosition = ui.element('div', { className: 'editor-cursor-position' });

    crumbs.element.classList.add('editor-crumbs');
    element.append(crumbs.element, cursorPosition);

    return { element, show, showCursor };

    function show(file, root) {
        element.hidden = !file;
        if (!file) return crumbs.set([]);
        const inRoot = !!root && isInside(file.path, root);
        const parts = inRoot ? [nameOf(root), ...relativePath(file.path, root).split('/')] : [util.tildify(file.path)];
        const items = [];
        parts.forEach((label, index) => {
            const last = index === parts.length - 1;
            if (index) items.push({ key: 'separator ' + index, separator: true });
            items.push({ key: String(index), label, last, path: file.path, revealable: !last && inRoot });
        });
        crumbs.set(items);
        showCursor(file);
    }

    function showCursor(file) {
        if (!file) return;
        const { state } = file.view;
        const head = state.selection.main.head;
        const line = state.doc.lineAt(head);
        const selected = state.selection.ranges.reduce((sum, range) => sum + (range.to - range.from), 0);
        const language = fileTypeOf(file.path)?.name || 'Plain Text';
        cursorPosition.textContent = `${selected ? selected + ' selected  ·  ' : ''}Line ${line.number}, Col ${head - line.from + 1}  ·  ${language}`;
    }

    function crumbOf(item) {
        if (item.separator) return ui.element('span', { className: 'editor-crumb-separator', text: '›' });
        const crumb = ui.element('span', { className: 'editor-crumb' });
        crumb.toggleAttribute('data-last', item.last);
        crumb.toggleAttribute('data-revealable', item.revealable);
        crumb.append(
            iconElement(
                ui,
                'editor-crumb-icon',
                item.last ? fileIconOf(ui, item.label, 12) : ui.folderIcon({ open: false, size: 12 })
            ),
            ui.element('span', { className: 'editor-crumb-label', text: item.label })
        );
        if (item.revealable) crumb.addEventListener('click', () => onReveal(item.path));
        return crumb;
    }
}

module.exports = { PATH_BAR_STYLE, filePathBar };
