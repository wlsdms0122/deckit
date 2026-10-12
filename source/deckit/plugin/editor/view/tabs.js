const TABS_STYLE = `
    .editor-tabs {
        display: flex;
        align-items: stretch;
        flex: 0 0 auto;
        height: 34px;
        padding: 8px 10px 0;
        overflow-x: auto;
        overflow-y: hidden;
        gap: 2px;
    }
    .editor-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        max-width: 220px;
        padding: 0 4px 0 10px;
        overflow: hidden;
        border-radius: 7px 7px 0 0;
        font: 12.5px var(--deckit-font);
        white-space: nowrap;
        cursor: pointer;
        opacity: 0.65;
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .editor-tab:hover { background: rgba(128, 128, 128, 0.08); }
    .editor-tab[data-active] { background: rgba(128, 128, 128, 0.16); opacity: 1; }
    .editor-tab-icon { display: flex; }
    .editor-tab-label { overflow: hidden; text-overflow: ellipsis; }
    .editor-tab[data-preview] .editor-tab-label { font-style: italic; }
    .editor-tab-end {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        opacity: 0;
    }
    .editor-tab[data-active] .editor-tab-end { opacity: 0.5; }
    .editor-tab[data-dirty] .editor-tab-end { opacity: 0.8; }
    .editor-tab:hover .editor-tab-end { opacity: 0.75; }
    .editor-tab-close { display: flex; }
    .editor-tab-dot { display: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .editor-tab[data-dirty]:not(:hover) .editor-tab-close { display: none; }
    .editor-tab[data-dirty]:not(:hover) .editor-tab-dot { display: block; }
`;

// The front workspace's files as tabs. The bar is drawn whole, so a new tab is told by comparing with the last drawing
// and grows in; a closed file's tab stays a moment in its place while it shrinks away. A switch of workspace swaps the
// whole row and is not animated.
function tabs({ theme, ui, isDirty, onSelect, onKeep, onClose, menuOf }) {
    const { motion } = theme;
    const TRANSITION = ['background-color', 'max-width', 'opacity', 'padding']
        .map(
            (property) =>
                `${property} ${property === 'background-color' ? motion.fast : motion.base}ms ${motion.easing}`
        )
        .join(', ');

    let files = [];
    let drawn = new Set(); // the paths of the last drawing
    let drawnFor = null; // the workspace drawn
    const leaving = new Map(); // tab element -> the index it had among the tabs
    const entering = new Map(); // path -> the tab element growing in, until it has

    const element = ui.element('div', { className: 'editor-tabs' });

    ui.contextMenu(element, {
        rowAt: (target) => target.closest?.('[data-path]') || null,
        items: (tab) => {
            const file = tab && files.find((open) => open.path === tab.dataset.path);
            return file ? menuOf(file) : null;
        },
    });

    return { element, set, letGo, rename };

    function set(list, { current, workspace }) {
        files = list;
        if (workspace !== drawnFor) {
            drawn = new Set(list.map((file) => file.path));
            drawnFor = workspace;
            leaving.clear();
        }
        // Leaving tabs stay in the document: a moved node restarts its transition and the shrink would snap.
        for (const child of [...element.children]) if (!leaving.has(child)) child.remove();
        const order = list.map((file) => ({ file }));
        for (const [tab, index] of [...leaving].sort((left, right) => left[1] - right[1]))
            order.splice(Math.min(index, order.length), 0, { tab });
        let before = null;
        for (const item of order) {
            const tab = item.tab || tabOf(item.file, item.file === current);
            if (!item.tab) element.insertBefore(tab, before ? before.nextSibling : element.firstChild);
            before = tab;
        }
        drawn = new Set(list.map((file) => file.path));
        element.style.display = list.length || leaving.size ? 'flex' : 'none';
    }

    // The tab of a file just closed, at `index` among the tabs drawn, shrinks away in its place.
    function letGo(path, index) {
        const tab = element.querySelector(`[data-path="${CSS.escape(path)}"]`);
        if (!tab || index < 0 || !motion.base) return;
        leaving.set(tab, index);
        tab.style.pointerEvents = 'none';
        tab.style.transition = TRANSITION;
        Object.assign(tab.style, { maxWidth: '0px', opacity: '0', padding: '0' });
        setTimeout(() => {
            if (!leaving.delete(tab)) return;
            tab.remove();
            if (!drawn.size && !leaving.size) element.style.display = 'none';
        }, motion.base);
    }

    // A renamed file keeps its tab; it does not grow in again.
    function rename(from, to) {
        if (drawn.delete(from)) drawn.add(to);
    }

    function tabOf(file, active) {
        const tab = ui.element('div', { className: 'editor-tab' });
        tab.dataset.path = file.path;
        tab.title = file.path;
        tab.toggleAttribute('data-active', active);
        tab.toggleAttribute('data-preview', file.preview);
        tab.toggleAttribute('data-dirty', isDirty(file));
        // Opening draws the bar more than once, so a growing tab carries on from where the last one reached.
        const growing = entering.get(file.path);
        if (!drawn.has(file.path) || growing) growIn(tab, file.path, growing);
        const icon = ui.element('span', { className: 'editor-tab-icon' });
        icon.innerHTML = fileIconOf(ui, file.path, 13);
        const end = ui.element('span', { className: 'editor-tab-end' });
        const close = ui.element('span', { className: 'editor-tab-close' });
        close.innerHTML = ui.icon('x', { size: 12 });
        end.append(ui.element('span', { className: 'editor-tab-dot' }), close);
        end.addEventListener('click', (event) => {
            event.stopPropagation();
            onClose(file);
        });
        tab.addEventListener('click', () => onSelect(file));
        tab.addEventListener('dblclick', () => onKeep(file));
        tab.addEventListener('auxclick', (event) => {
            if (event.button === 1) onClose(file);
        });
        tab.append(icon, ui.element('span', { className: 'editor-tab-label', text: nameOf(file.path) }), end);
        return tab;
    }

    function growIn(tab, path, growing) {
        Object.assign(tab.style, {
            maxWidth: (growing ? Math.round(growing.getBoundingClientRect().width) : 0) + 'px',
            opacity: growing ? growing.style.opacity : '0',
            padding: growing ? growing.style.padding : '0',
        });
        entering.set(path, tab);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                // Drawn again since: the newer tab carries on.
                if (entering.get(path) !== tab) return;
                tab.style.transition = TRANSITION;
                Object.assign(tab.style, { maxWidth: '', opacity: '', padding: '' });
                setTimeout(() => {
                    if (entering.get(path) === tab) entering.delete(path);
                }, motion.base);
            })
        );
    }
}
