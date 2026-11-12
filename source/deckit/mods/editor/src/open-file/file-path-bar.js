const { fileTypeOf } = require('../file-type/file-type.js');
const { nameOf, isInside, relativePath } = require('../path/path.js');

const PATH_BAR_STYLE = `
    .editor-path-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: 0 0 auto;
        height: 28px;
        box-sizing: border-box;
        padding: 0 12px 0 7px;
        border-bottom: 1px solid var(--deckit-divider);
        background: var(--deckit-background);
        font: var(--deckit-type-small);
        white-space: nowrap;
        overflow: hidden;
    }
    .editor-path-bar[hidden] { display: none; }
    .editor-path-bar .deckit-crumb { font: var(--deckit-type-small); }
    .editor-path-bar .deckit-crumb[aria-current='page'] { font-weight: 600; }
    .editor-cursor { display: flex; gap: 16px; flex: 0 0 auto; color: var(--deckit-muted); font: var(--deckit-type-small); }
    .editor-cursor-position { font-variant-numeric: tabular-nums; }
`;

// Above the open file: where it is, from its workspace's folder, and where the cursor is. A folder of the path reveals
// the file in the workspace's tree.
function filePathBar({ ui, tildify, onReveal }) {
    let shownPath = null;

    const element = ui.element('div', { className: 'editor-path-bar' });
    const crumbs = ui.breadcrumb({ onGo: () => shownPath && onReveal(shownPath) });
    const cursor = ui.element('div', { className: 'editor-cursor' });
    const selected = ui.element('span');
    const position = ui.element('span', { className: 'editor-cursor-position' });
    const language = ui.element('span');

    cursor.append(selected, position, language);
    element.append(crumbs.element, cursor);

    return { element, show, showCursor };

    function show(file, root) {
        element.hidden = !file;
        shownPath = file?.path ?? null;
        if (!file) return crumbs.set([]);
        const inRoot = !!root && isInside(file.path, root);
        const parts = inRoot ? [nameOf(root), ...relativePath(file.path, root).split('/')] : [tildify(file.path)];
        crumbs.set(
            parts.map((label, index) => ({
                key: String(index),
                label,
                current: index === parts.length - 1,
            }))
        );
        showCursor(file);
    }

    function showCursor(file) {
        if (!file) return;
        const { state } = file.view;
        const head = state.selection.main.head;
        const line = state.doc.lineAt(head);
        const count = state.selection.ranges.reduce((sum, range) => sum + (range.to - range.from), 0);
        selected.textContent = count ? `${count} selected` : '';
        selected.hidden = !count;
        position.textContent = `Line ${line.number}, Col ${head - line.from + 1}`;
        language.textContent = fileTypeOf(file.path)?.name || 'Plain Text';
    }
}

module.exports = { PATH_BAR_STYLE, filePathBar };
