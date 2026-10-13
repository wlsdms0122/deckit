const { heldSelection } = require('./held-selection.js');
const { parentOf } = require('./path.js');
const { isVisible, visibleEntries, nextSortOrder } = require('./sort.js');

// The files of the tab in front, as columns or as a list, the filter over them and the count under them. The view and
// the sort order are kept in `values`. `tabs` is the tab list, read and set through its queries and setters;
// `status` shows the folder loading, failing or empty; `onDraw()` hears every draw; `setFilterText(text)` shows the
// filter's text.
function fileArea({
    ui,
    values,
    tabs,
    listings,
    list,
    columns,
    status,
    showsHidden,
    foldersFirst,
    select,
    setFilterText,
    onDraw,
}) {
    const LAYOUT = {
        list: { display: 'block', overflowX: 'hidden', overflowY: 'auto', padding: '4px 12px 8px' },
        columns: { display: 'flex', overflowX: 'auto', overflowY: 'hidden', padding: '0 0 0 6px' },
    };
    const NEAREST = { block: 'nearest', inline: 'nearest' };
    const STATUS_DURATION = 2500; // milliseconds
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
    let view = values.get('view', 'columns');
    let sortOrder = values.get('sort', { key: 'name', up: true });
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
        draw,
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
        rowOf,
        labelOf,
        folderAt,
    };

    function setView(next) {
        view = next;
        values.set('view', view);
        draw();
    }

    function sortBy(key) {
        sortOrder = nextSortOrder(sortOrder, key);
        values.set('sort', sortOrder);
        draw();
    }

    function failToStart(error) {
        startFailure = { title: 'Could not start', hint: error.message, permission: false };
        draw();
    }

    // While the tab's folder loads or fails, either view shows the list's place with the status in it.
    function draw() {
        if (tabs.location()) holdSelection();
        const loading = isLoading();
        const failure = loading ? null : listings.of(tabs.location())?.failure || startFailure;
        const asColumns = view === 'columns' && !loading && !failure;
        const shown = asColumns ? [columns.element] : [list.element, status.element];
        list.header.hidden = view === 'columns';
        Object.assign(element.style, LAYOUT[asColumns ? 'columns' : 'list']);
        if (element.firstChild !== shown[0]) element.replaceChildren(...shown);
        if (asColumns) drawColumns();
        else drawList(loading, failure);
        footer.textContent = failure || loading ? '' : countText();
        onDraw();
    }

    // Columns follow the lead; the list only marks the selection, so the rest stays as drawn.
    function showSelection() {
        if (view === 'columns') draw();
        else {
            list.select(tabs.selection());
            footer.textContent = countText();
        }
    }

    function reveal(path) {
        rowOf(path)?.scrollIntoView(NEAREST);
        if (view === 'columns') columns.endElement()?.scrollIntoView(NEAREST);
    }

    function showStatus(text) {
        footer.textContent = text;
        setTimeout(draw, STATUS_DURATION);
    }

    function filterBy(typed) {
        if (!tabs.front()) return;
        const text = typed.trim().toLowerCase();
        const filter = tabs.filter();
        tabs.setFilter(text, !text ? null : filter.text ? filter.folder : walkedFolder());
        draw();
    }

    function pickFirstMatch() {
        const entries = entriesIn(tabs.filter().folder || walkedFolder());
        if (!entries.length) return;
        select(entries[0].path, { reveal: true });
        element.focus();
    }

    function cancelFilter() {
        if (tabs.front()) clearFilter();
        else setFilterText('');
        draw();
        element.focus();
    }

    function clearFilter() {
        tabs.clearFilter();
        setFilterText('');
    }

    function isLoading() {
        return !!tabs.location() && !listings.has(tabs.location());
    }

    function entriesIn(folder) {
        const filter = tabs.filter();
        return visibleEntries(listings.of(folder)?.entries ?? [], {
            showHidden: showsHidden(),
            filter: folder === filter.folder ? filter.text : '',
            order: sortOrder,
            foldersFirst: foldersFirst(),
        });
    }

    // Down to the lead, or with more than one entry selected, down to the folder that holds them.
    function columnFolders() {
        const lead = tabs.selectedPath();
        return columns.foldersOf(tabs.location(), tabs.selection().length > 1 ? parentOf(lead) : lead);
    }

    function shownFolders() {
        if (view === 'columns') return columnFolders();
        return tabs.location() ? [tabs.location()] : [];
    }

    // The folder the keyboard walks: in columns the one holding the lead, in the list the tab's.
    function walkedFolder() {
        if (view !== 'columns') return tabs.location();
        const selected = tabs.selectedPath();
        return selected && columnFolders().includes(parentOf(selected)) ? parentOf(selected) : tabs.location();
    }

    // Where a new folder goes: the last column, or the list's folder.
    function workingFolder() {
        return view === 'columns' ? columnFolders().at(-1) || null : tabs.location();
    }

    // The row of `path` in either view.
    function rowOf(path) {
        return element.querySelector(`[data-path="${CSS.escape(path)}"]`);
    }

    function labelOf(path) {
        return rowOf(path)?.querySelector('[data-name]');
    }

    // A drop on a folder's row goes into it; on a column or the preview, into that column's folder; anywhere else,
    // into the tab's folder once it is read.
    function folderAt(under) {
        const row = under.closest('[data-path]');
        const entry = row && listings.entryAt(row.dataset.path);
        if (entry?.kind === 'folder') return { folder: entry.path, mark: row };
        const column = columns.folderAt(under);
        if (column) return column;
        return tabs.location() && !isLoading() ? { folder: tabs.location(), mark: element } : null;
    }

    function drawList(loading, failure) {
        const location = tabs.location();
        const entries = loading || failure ? [] : entriesIn(location);
        list.draw({ entries, selection: tabs.selection(), sortOrder });
        status.draw({
            folder: location,
            loading,
            failure,
            isEmpty: !entries.length,
            filtering: !!tabs.filter().text,
            hasHidden: (listings.of(location)?.entries.length ?? 0) > 0,
        });
    }

    // The drawing asks for the read of a folder with no listing, so no path to a column can forget to.
    function drawColumns() {
        const folders = columnFolders();
        for (const folder of folders) listings.request(folder);
        const selected = tabs.selectedPath();
        const selection = tabs.selection();
        const filter = tabs.filter();
        const picked = selection.length > 1 ? null : listings.entryAt(selected);
        columns.draw({
            tab: tabs.front(),
            widths: tabs.widths(),
            selected,
            selection,
            folders: folders.map((folder) => ({
                folder,
                listing: listings.of(folder),
                entries: entriesIn(folder),
                filtering: folder === filter.folder && !!filter.text,
            })),
            previewed: picked && picked.kind !== 'folder' && folders.includes(parentOf(picked.path)) ? picked : null,
        });
    }

    function countText() {
        const filter = tabs.filter();
        const counted = filter.text ? filter.folder : walkedFolder();
        const total = (listings.of(counted)?.entries ?? []).filter((entry) => isVisible(entry, showsHidden())).length;
        const selected = tabs.selection().length;
        if (selected > 1) return `${selected} of ${filter.text ? entriesIn(counted).length : total} selected`;
        if (!filter.text) return `${total} item${total === 1 ? '' : 's'}`;
        return `${entriesIn(counted).length} of ${total} item${total === 1 ? '' : 's'}`;
    }

    // Several selected are what their folder shows of them, the filter's too: an entry it no longer shows leaves, and
    // the lead and the anchor go to the last one left when theirs does. One selected is held by `heldSelection`.
    function holdSelection() {
        const lead = tabs.selectedPath();
        const selection = tabs.selection();
        if (selection.length > 1 && listings.of(parentOf(lead))) {
            const shown = new Set(entriesIn(parentOf(lead)).map((entry) => entry.path));
            const kept = selection.filter((path) => shown.has(path));
            if (kept.length && kept.length !== selection.length) {
                const keptLead = kept.includes(lead) ? lead : kept.at(-1);
                tabs.setSelection(kept, {
                    lead: keptLead,
                    anchor: kept.includes(tabs.anchor()) ? tabs.anchor() : keptLead,
                });
            } else if (!kept.length) tabs.select(null);
        } else {
            const held = heldSelection({
                location: tabs.location(),
                selected: lead,
                inColumns: view === 'columns',
                listingOf: listings.of,
                showHidden: showsHidden(),
            });
            if (held !== lead) tabs.select(held);
        }
        // The filter goes when its folder does.
        const filter = tabs.filter();
        if (filter.text && !shownFolders().includes(filter.folder)) clearFilter();
    }
}

module.exports = { fileArea };
