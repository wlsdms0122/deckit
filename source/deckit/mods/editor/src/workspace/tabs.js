const { fileIconOf } = require('../file-type/file-type.js');
const { iconElement } = require('../icon-element/icon-element.js');
const { nameOf } = require('../path/path.js');

const TABS_STYLE = `
    .editor-tabs { overflow-x: auto; overflow-y: hidden; }
    /* Two tabs or more sit on a track, the chosen one lifted off it; a lone tab has nothing to be chosen from. */
    .editor-tab-list {
        display: flex;
        align-items: stretch;
        gap: 2px;
        height: 32px;
        box-sizing: border-box;
        border-radius: var(--deckit-radius-medium);
    }
    .editor-tab-list[data-many] { padding: 2px; background: var(--deckit-fill); }
    .editor-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        max-width: 220px;
        overflow: hidden;
        border-radius: var(--deckit-radius-control);
        color: var(--deckit-muted);
        font: var(--deckit-type-body);
        white-space: nowrap;
        cursor: pointer;
        --app-region: no-drag;
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .editor-tab:hover { background: var(--deckit-hover); }
    .editor-tab[data-active] { color: var(--deckit-text); }
    /* The tab strip is the title bar: not key, its active tab goes to muted with the rest of it. */
    [data-deckit-key='false'] .editor-tab[data-active] { color: var(--deckit-muted); }
    .editor-tab-list[data-many] .editor-tab[data-active] {
        background: var(--deckit-thumb);
        box-shadow: var(--deckit-shadow-control);
    }
    .editor-tab-icon { display: flex; margin-left: 10px; }
    .editor-tab-label { overflow: hidden; text-overflow: ellipsis; }
    .editor-tab[data-preview] .editor-tab-label { font-style: italic; }
    .editor-tab-end {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        margin-right: 4px;
        border-radius: var(--deckit-radius-control);
        color: var(--deckit-muted);
        opacity: 0;
        transition: background-color var(--deckit-press-fade) var(--deckit-press-curve);
    }
    .editor-tab:is([data-active], [data-unsaved], :hover) .editor-tab-end { opacity: 1; }
    .editor-tab-end:hover { background: var(--deckit-hover); color: var(--deckit-text); }
    .editor-tab-close { display: flex; }
    .editor-tab-dot { display: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .editor-tab[data-unsaved]:not(:hover) .editor-tab-close { display: none; }
    .editor-tab[data-unsaved]:not(:hover) .editor-tab-dot { display: block; }
`;

// The front workspace's files as tabs, keyed by the open file, so a renamed file keeps its tab. A new tab fades in and
// a closed one leaves at once, and a tab dragged along the row is put in a new order (`onReorder(file, toFile)`). A
// switch of workspace draws a new list, so the row is swapped whole and nothing plays. The row is the view's title
// bar, there with no tab as well: the window is dragged by it.
function tabs({ ui, isDirty, onSelect, onKeep, onClose, onReorder, menuOf }) {
    let files = [];
    let shownFor = null; // the workspace whose tabs are drawn

    const element = ui.element('div', { className: 'editor-tabs' });
    ui.titleBar(element);
    let rows = tabList();

    element.append(rows.element);
    ui.contextMenu(element, {
        rowAt: (target) => target.closest?.('[data-path]') || null,
        items: (tab) => {
            const file = tab && files.find((open) => open.path === tab.dataset.path);
            return file ? menuOf(file) : null;
        },
    });

    return { element, set };

    function set(list, { current, workspace }) {
        files = list;
        if (workspace !== shownFor) {
            shownFor = workspace;
            rows = tabList();
            element.replaceChildren(rows.element);
        }
        rows.element.toggleAttribute('data-many', list.length > 1);
        rows.set(
            list.map((file) => ({
                file,
                path: file.path,
                active: file === current,
                preview: file.preview,
                unsaved: isDirty(file),
            }))
        );
    }

    function tabList() {
        const list = ui.list({ key: (item) => item.file, create: tabOf, update: refresh, animated: true });
        list.element.classList.add('editor-tab-list');
        ui.sortable(list, { onReorder });
        return list;
    }

    function tabOf(item) {
        const { file } = item;
        const tab = ui.element('div', { className: 'editor-tab' });
        const end = ui.element('span', { className: 'editor-tab-end' });
        end.append(
            ui.element('span', { className: 'editor-tab-dot' }),
            iconElement(ui, 'editor-tab-close', ui.icon('x', { size: 12 }))
        );
        end.addEventListener('click', (event) => {
            event.stopPropagation();
            onClose(file);
        });
        tab.addEventListener('click', () => onSelect(file));
        tab.addEventListener('dblclick', () => onKeep(file));
        tab.addEventListener('auxclick', (event) => {
            if (event.button === 1) onClose(file);
        });
        tab.append(iconElement(ui, 'editor-tab-icon', ''), ui.element('span', { className: 'editor-tab-label' }), end);
        refresh(tab, item);
        return tab;
    }

    function refresh(tab, item) {
        tab.toggleAttribute('data-active', item.active);
        tab.toggleAttribute('data-preview', item.preview);
        tab.toggleAttribute('data-unsaved', item.unsaved);
        if (tab.dataset.path === item.path) return;
        tab.dataset.path = item.path;
        tab.title = item.path;
        tab.querySelector('.editor-tab-icon').innerHTML = fileIconOf(ui, item.path, 13);
        tab.querySelector('.editor-tab-label').textContent = nameOf(item.path);
    }
}

module.exports = { TABS_STYLE, tabs };
