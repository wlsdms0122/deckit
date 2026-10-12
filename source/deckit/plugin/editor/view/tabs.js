const TABS_STYLE = `
    .editor-tabs {
        display: flex;
        align-items: stretch;
        flex: 0 0 auto;
        height: 34px;
        padding: 8px 10px 0;
        overflow-x: auto;
        overflow-y: hidden;
    }
    .editor-tabs:has(> .editor-tab-list:empty) { display: none; }
    .editor-tab-list { display: flex; align-items: stretch; gap: 2px; }
    .editor-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        max-width: 220px;
        overflow: hidden;
        border-radius: 7px 7px 0 0;
        font: 12.5px var(--deckit-font);
        white-space: nowrap;
        cursor: pointer;
        opacity: 0.65;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .editor-tab:hover { background: var(--deckit-hover); }
    .editor-tab[data-active] { background: var(--deckit-selected); opacity: 1; }
    .editor-tab-icon { display: flex; margin-left: 10px; }
    .editor-tab-label { overflow: hidden; text-overflow: ellipsis; }
    .editor-tab[data-preview] .editor-tab-label { font-style: italic; }
    .editor-tab-end {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-right: 4px;
        border-radius: 4px;
        opacity: 0;
    }
    .editor-tab[data-active] .editor-tab-end { opacity: 0.5; }
    .editor-tab[data-unsaved] .editor-tab-end { opacity: 0.8; }
    .editor-tab:hover .editor-tab-end { opacity: 0.75; }
    .editor-tab-close { display: flex; }
    .editor-tab-dot { display: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .editor-tab[data-unsaved]:not(:hover) .editor-tab-close { display: none; }
    .editor-tab[data-unsaved]:not(:hover) .editor-tab-dot { display: block; }
`;

// The front workspace's files as tabs, keyed by the open file, so a renamed file keeps its tab. A new tab grows in and
// a closed one folds away. A switch of workspace draws a new list, so the row is swapped whole and nothing plays. The
// tab's space is in its icon's and its end's margins, which fold with it.
function tabs({ theme, ui, isDirty, onSelect, onKeep, onClose, menuOf }) {
    const { motion } = theme;
    const TRANSITION = ['background-color', 'max-width', 'opacity']
        .map(
            (property) =>
                `${property} ${property === 'background-color' ? motion.fast : motion.base}ms ${motion.easing}`
        )
        .join(', ');

    let files = [];
    let shownFor = null; // the workspace whose tabs are drawn
    // Until the list's first drawing: what is there then was there before.
    let firstDrawing = true;

    const element = ui.element('div', { className: 'editor-tabs' });
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
            firstDrawing = true;
            element.replaceChildren(rows.element);
        }
        rows.set(
            list.map((file) => ({
                file,
                path: file.path,
                active: file === current,
                preview: file.preview,
                unsaved: isDirty(file),
            }))
        );
        firstDrawing = false;
    }

    function tabList() {
        const list = ui.list({ key: (item) => item.file, create: tabOf, update: refresh, exit: true });
        list.element.classList.add('editor-tab-list');
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
        if (!firstDrawing) growIn(tab);
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

    // From nothing to its width, once it is in the page.
    function growIn(tab) {
        if (!motion.base) return;
        Object.assign(tab.style, { maxWidth: '0px', opacity: '0' });
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                tab.style.transition = TRANSITION;
                Object.assign(tab.style, { maxWidth: '', opacity: '' });
                setTimeout(() => (tab.style.transition = ''), motion.base);
            })
        );
    }
}
