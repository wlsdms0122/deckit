// The files of the tab in front, as columns or as a list, the filter over them and the count under them. The view and
// the sort order are kept in `store`. `front()` is the tab in front; `onDraw()` hears every draw; `setFilterText(text)`
// shows the filter's text.
function fileArea({ ui, store, settings, listings, list, columns, front, select, setFilterText, onDraw }) {
    const LAYOUT = {
        list: { display: 'block', overflowX: 'hidden', overflowY: 'auto', padding: '4px 12px 8px' },
        columns: { display: 'flex', overflowX: 'auto', overflowY: 'hidden', padding: '0 0 0 6px' },
    };
    const NEAREST = { block: 'nearest', inline: 'nearest' };
    const STATUS_MS = 2500;
    const STYLE = `
        .finder-files { position: relative; flex: 1 1 auto; min-height: 0; outline: none; }
        .finder-footer {
            flex: 0 0 auto;
            padding: 5px 20px 8px;
            border-top: var(--deckit-border);
            color: var(--deckit-muted);
            font: 11.5px var(--deckit-font);
        }
    `;
    let view = store.get('view', 'columns');
    let sortOrder = store.get('sort', { key: 'name', up: true });
    let startFailure = null;

    const element = ui.element('div', { className: 'finder-files' });
    const footer = ui.element('div', { className: 'finder-footer' });

    ui.addStyle(STYLE);
    element.tabIndex = 0;

    return {
        element,
        footer,
        view: () => view,
        setView,
        sortBy,
        failToStart,
        render,
        showSelection,
        reveal,
        showStatus,
        filterBy,
        pickFirstMatch,
        cancelFilter,
        clearFilter,
        isLoading,
        entriesIn,
        columnFolders,
        shownFolders,
        walkedFolder,
        workingFolder,
        labelOf,
        folderUnder,
    };

    function setView(next) {
        view = next;
        store.set('view', view);
        render();
    }

    function sortBy(key) {
        sortOrder = nextSortOrder(sortOrder, key);
        store.set('sort', sortOrder);
        render();
    }

    function failToStart(error) {
        startFailure = { title: 'Could not start', hint: error.message, permission: false };
        render();
    }

    function render() {
        const tab = front();
        if (tab?.location) holdSelection(tab);
        const loading = isLoading();
        const failure = loading ? null : listings.of(currentLocation())?.failure || startFailure;
        const asColumns = view === 'columns' && !loading && !failure;
        const shown = asColumns ? columns : list;
        list.header.hidden = view === 'columns';
        Object.assign(element.style, LAYOUT[asColumns ? 'columns' : 'list']);
        if (element.firstChild !== shown.element) element.replaceChildren(shown.element);
        if (asColumns) drawColumns(tab);
        else drawList(tab, loading, failure);
        footer.textContent = failure || loading ? '' : countText(tab);
        onDraw();
    }

    // Columns follow the pick; the list only marks it, so the rest stays as drawn.
    function showSelection() {
        if (view === 'columns') render();
        else list.select(front()?.selected ?? null);
    }

    function reveal(path) {
        element.querySelector(`[data-path="${CSS.escape(path)}"]`)?.scrollIntoView(NEAREST);
        if (view === 'columns') columns.revealEnd();
    }

    function showStatus(text) {
        footer.textContent = text;
        setTimeout(render, STATUS_MS);
    }

    function filterBy(text) {
        const tab = front();
        if (!tab) return;
        if (!tab.filter) tab.filterFolder = walkedFolder();
        tab.filter = text.trim().toLowerCase();
        if (!tab.filter) tab.filterFolder = null;
        render();
    }

    function pickFirstMatch() {
        const entries = entriesIn(front()?.filterFolder || walkedFolder());
        if (!entries.length) return;
        select(entries[0].path, { reveal: true });
        element.focus();
    }

    function cancelFilter() {
        const tab = front();
        if (tab) clearFilter(tab);
        else setFilterText('');
        render();
        element.focus();
    }

    function clearFilter(tab) {
        tab.filter = '';
        tab.filterFolder = null;
        setFilterText('');
    }

    function isLoading() {
        return !!currentLocation() && !listings.has(currentLocation());
    }

    function entriesIn(folder) {
        const tab = front();
        return visibleEntries(listings.of(folder)?.entries ?? [], {
            showHidden: showsHidden(),
            filter: tab && folder === tab.filterFolder ? tab.filter : '',
            order: sortOrder,
            foldersFirst: !!settings.get('foldersFirst'),
        });
    }

    function columnFolders() {
        return columns.foldersOf(currentLocation(), front()?.selected ?? null);
    }

    function shownFolders() {
        if (view === 'columns') return columnFolders();
        return currentLocation() ? [currentLocation()] : [];
    }

    // The folder the keyboard walks: in columns the one holding the pick, in the list the tab's.
    function walkedFolder() {
        if (view !== 'columns') return currentLocation();
        const selected = front()?.selected;
        return selected && columnFolders().includes(parentOf(selected)) ? parentOf(selected) : currentLocation();
    }

    // Where a new folder goes: the last column, or the list's folder.
    function workingFolder() {
        return view === 'columns' ? columnFolders().at(-1) || null : currentLocation();
    }

    function labelOf(path) {
        return element.querySelector(`[data-path="${CSS.escape(path)}"] [data-name]`);
    }

    // A drop on a folder's row goes into it; on a column or the preview, into that column's folder; anywhere else,
    // into the tab's folder once it is read.
    function folderUnder(under) {
        const row = under.closest('[data-path]');
        const entry = row && listings.entryAt(row.dataset.path);
        if (entry?.kind === 'folder') return { folder: entry.path, mark: row };
        const column = columns.folderAt(under);
        if (column) return column;
        return currentLocation() && !isLoading() ? { folder: currentLocation(), mark: element } : null;
    }

    function drawList(tab, loading, failure) {
        list.draw({
            folder: currentLocation(),
            loading,
            failure,
            entries: entriesIn(currentLocation()),
            selected: tab?.selected ?? null,
            sortOrder,
            filtering: !!tab?.filter,
            hasHidden: (listings.of(currentLocation())?.entries.length ?? 0) > 0,
        });
    }

    // The drawing asks for the read of a folder with no listing, so no path to a column can forget to.
    function drawColumns(tab) {
        const folders = columnFolders();
        for (const folder of folders) listings.request(folder);
        const picked = listings.entryAt(tab?.selected);
        columns.draw({
            tab,
            selected: tab?.selected ?? null,
            folders: folders.map((folder) => ({
                folder,
                listing: listings.of(folder),
                entries: entriesIn(folder),
                filtering: folder === tab.filterFolder && !!tab.filter,
            })),
            previewed: picked && picked.kind !== 'folder' && folders.includes(parentOf(picked.path)) ? picked : null,
        });
    }

    function countText(tab) {
        const counted = tab?.filter ? tab.filterFolder : walkedFolder();
        const total = (listings.of(counted)?.entries ?? []).filter((entry) => isVisible(entry, showsHidden())).length;
        if (!tab?.filter) return `${total} item${total === 1 ? '' : 's'}`;
        return `${entriesIn(counted).length} of ${total} item${total === 1 ? '' : 's'}`;
    }

    function holdSelection(tab) {
        tab.selected = heldSelection({
            location: tab.location,
            selected: tab.selected,
            inColumns: view === 'columns',
            listingOf: listings.of,
            showHidden: showsHidden(),
        });
        // The filter goes when its folder does.
        if (tab.filter && !shownFolders().includes(tab.filterFolder)) clearFilter(tab);
    }

    function currentLocation() {
        return front()?.location ?? null;
    }

    function showsHidden() {
        return !!settings.get('showHidden');
    }
}
