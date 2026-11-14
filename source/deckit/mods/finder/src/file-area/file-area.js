const { heldSelection } = require('./held-selection.js');
const { parentOf, isInside } = require('../path/path.js');
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
    const STYLE = `
        .finder-files { position: relative; flex: 1 1 auto; min-height: 0; }
        .finder-footer {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
            height: 28px;
            box-sizing: border-box;
            padding: 0 16px;
            border-top: 1px solid var(--deckit-divider);
            color: var(--deckit-muted);
            font: var(--deckit-type-small);
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }
        .finder-failure { flex: 0 0 auto; padding: 0 12px 8px; }
        .finder-failure[hidden] { display: none; }
    `;
    let view = values.get('view', 'columns');
    let sortOrder = values.get('sort', { key: 'name', up: true });
    let startFailure = null;
    // What the person asked that failed, `{ text, retry, details, location }`: said over the footer until it is tried
    // again, another is asked, or another folder is in front.
    let said = null;
    let drawnSaid = null; // the one the notice shows, kept as drawn, its Details open or not, until another is said

    const element = ui.element('div', { className: 'finder-files' });
    const footer = ui.element('div', { className: 'finder-footer' });
    const failure = ui.element('div', { className: 'finder-failure' });
    failure.hidden = true;

    ui.addStyle(STYLE);

    return {
        element,
        footer,
        failure,
        view: () => view,
        setView,
        sortBy,
        failToStart,
        draw,
        showSelection,
        reveal,
        showFailure,
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
        folderInFront,
        rowOf,
        labelOf,
        folderAt,
        draggableRowAt,
        listAt,
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
        const loading = isLoading() || status.holds(draw);
        const failure = loading ? null : listings.of(tabs.location())?.failure || startFailure;
        const asColumns = view === 'columns' && !loading && !failure;
        const shown = asColumns ? [columns.element] : [list.element, status.element];
        list.header.hidden = view === 'columns';
        Object.assign(element.style, LAYOUT[asColumns ? 'columns' : 'list']);
        if (element.firstChild !== shown[0]) element.replaceChildren(...shown);
        if (asColumns) drawColumns();
        else drawList(loading, failure);
        drawFooter(failure || loading);
        onDraw();
    }

    // Columns follow where the tab is opened; the list only marks the selection, so the rest stays as drawn.
    function showSelection() {
        if (view === 'columns') draw();
        else {
            list.select(tabs.selection());
            drawFooter(false);
        }
    }

    function reveal(path) {
        rowOf(path)?.scrollIntoView(NEAREST);
        if (view === 'columns') columns.endElement()?.scrollIntoView(NEAREST);
    }

    // `text` said in a failure notice over the footer, with `details` behind its disclosure and Try Again where
    // `retry` runs it again; null takes it away.
    function showFailure(text, retry = null, details = '') {
        if (!text && !said) return;
        said = text ? { text, retry, details, location: tabs.location() } : null;
        drawFooter(false);
    }

    // The count, or nothing while `blank`; and what failed, while it holds.
    function drawFooter(blank) {
        if (said && said.location !== tabs.location()) said = null;
        footer.textContent = blank ? '' : countText();
        failure.hidden = !said;
        if (said === drawnSaid) return;
        drawnSaid = said;
        if (!said) return failure.replaceChildren();
        const { text, retry, details } = said;
        const again = retry && {
            label: 'Try Again',
            run: () => {
                showFailure(null);
                retry();
            },
        };
        failure.replaceChildren(ui.notice({ kind: 'failure', text, details, action: again }).element);
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

    function columnFolders() {
        return columns.foldersOf(tabs.location(), tabs.opened());
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

    // The folder in front, where a new folder goes.
    function workingFolder() {
        return folderInFront(tabs.location(), tabs.opened());
    }

    // The folder in front of a tab at `location` opened down to `opened`: the last column's, or the list's.
    function folderInFront(location, opened) {
        return view === 'columns' ? columns.foldersOf(location, opened).at(-1) || null : location;
    }

    // The row of `path` in either view.
    function rowOf(path) {
        return element.querySelector(`[data-path="${CSS.escape(path)}"]`);
    }

    function labelOf(path) {
        return rowOf(path)?.querySelector('[data-name]');
    }

    // A drop on a folder's row goes into it; on a column or the preview, into that column's folder; anywhere else,
    // into the folder in front, the last column's or the list's, once the tab's folder is read.
    function folderAt(under) {
        const row = under.closest('[data-path]');
        const entry = row && listings.entryAt(row.dataset.path);
        if (entry?.kind === 'folder') return { folder: entry.path, mark: row };
        const column = columns.folderAt(under);
        if (column) return column;
        return tabs.location() && !isLoading() ? { folder: workingFolder(), mark: element } : null;
    }

    // The row a press on `under` drags: in columns any of it, in the list its icon and name.
    function draggableRowAt(under) {
        if (view === 'columns') return under.closest('[data-path]');
        return under.closest('.finder-list-name > *')?.closest('[data-path]') ?? null;
    }

    // The rows a rectangle dragged from `under` selects among, and their folder: a column's, or the list's. Where a
    // press drags a row, no rectangle starts. A column with more after it answers `opened` too, the path the tab is
    // opened down to, which a rectangle there leaves open.
    function listAt(under) {
        if (draggableRowAt(under)) return null;
        if (view !== 'columns')
            return tabs.location() && !isLoading() ? { list: list.rows, folder: tabs.location() } : null;
        const place = columns.listAt(under);
        return place && place.folder !== columnFolders().at(-1) ? { ...place, opened: tabs.opened() } : place;
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
        const filter = tabs.filter();
        const opened = listings.entryAt(tabs.opened());
        columns.draw({
            tab: tabs.front(),
            widths: tabs.widths(),
            selected: tabs.selectedPath(),
            selection: tabs.selection(),
            folders: folders.map((folder) => ({
                folder,
                listing: listings.of(folder),
                entries: entriesIn(folder),
                filtering: folder === filter.folder && !!filter.text,
            })),
            previewed: opened && opened.kind !== 'folder' && folders.includes(parentOf(opened.path)) ? opened : null,
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

    // The selection held to what is on screen, and in columns the path they are opened down to.
    function holdSelection() {
        holdEntries();
        if (view === 'columns') holdOpened();
        clearGoneFilter();
    }

    // Several selected keep those their folder still shows, the filter's included, in the order it shows them: the lead
    // goes to the last one kept when it leaves, and the anchor to the lead when it leaves. They wait while the folder
    // is unread. One selected, or none of several kept, is the lead held by `heldSelection`.
    function holdEntries() {
        const lead = tabs.selectedPath();
        const selection = tabs.selection();
        const several = selection.length > 1;
        if (several && !listings.of(parentOf(lead))) return;
        const kept = several
            ? entriesIn(parentOf(lead))
                  .map((entry) => entry.path)
                  .filter((path) => selection.includes(path))
            : [];
        if (kept.length) {
            if (kept.length === selection.length) return;
            const keptLead = kept.includes(lead) ? lead : kept.at(-1);
            tabs.setSelection(kept, {
                lead: keptLead,
                anchor: kept.includes(tabs.anchor()) ? tabs.anchor() : keptLead,
            });
        } else {
            const held = heldSelection({
                location: tabs.location(),
                selected: lead,
                inColumns: view === 'columns',
                listingOf: listings.of,
                showHidden: showsHidden(),
            });
            if (held !== lead || several) tabs.select(held);
        }
    }

    // A path a rectangle left open that the disk has cut closes: the columns are opened down to the selection again.
    // Only a path inside the tab's folder can be cut; the folder itself, opened while several of its entries are
    // selected, stays while the tab is there.
    function holdOpened() {
        const opened = tabs.opened();
        if (!opened || !isInside(opened, tabs.location())) return;
        const held = heldSelection({
            location: tabs.location(),
            selected: opened,
            inColumns: true,
            listingOf: listings.of,
            showHidden: showsHidden(),
        });
        if (held !== opened) tabs.setSelection(tabs.selection(), { lead: tabs.selectedPath(), anchor: tabs.anchor() });
    }

    function clearGoneFilter() {
        // The filter goes when its folder does.
        const filter = tabs.filter();
        if (filter.text && !shownFolders().includes(filter.folder)) clearFilter();
    }
}

module.exports = { fileArea };
