// A folder as rows under a header that sorts them. Narrow, it drops the Kind column and then the Size column. It also
// shows the tab's folder loading or failing, in either view.
function listView({ ui, icons, chordOf, onSort, onShowHidden, onReveal, onPrivacySettings }) {
    const COLUMNS = [
        { key: 'name', label: 'Name' },
        { key: 'mtime', label: 'Date Modified', width: 150 },
        { key: 'size', label: 'Size', width: 76, right: true },
        { key: 'kind', label: 'Kind', width: 120 },
    ];
    const SHOWS_KIND_FROM = 620;
    const SHOWS_SIZE_FROM = 470;
    const STYLE = `
        .finder-list-header {
            display: grid;
            align-items: center;
            flex: 0 0 auto;
            height: 26px;
            margin: 0 12px;
            padding: 0 8px;
            border-bottom: var(--deckit-border);
            color: var(--deckit-muted);
            font: 600 11.5px var(--deckit-font);
        }
        .finder-list-header[hidden] { display: none; }
        .finder-sort {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 3px;
            min-width: 0;
            height: 100%;
            padding: 0;
            border: 0;
            background: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }
        .finder-sort[data-right] { justify-content: flex-end; padding-right: 8px; }
        .finder-sort[data-sorted] { color: var(--deckit-text); }
        .finder-sort-label { overflow: hidden; text-overflow: ellipsis; }
        .finder-sort-caret { display: flex; }
        .finder-list-row.deckit-row[data-size] {
            display: grid;
            gap: 0;
            height: 26px;
            cursor: default;
            transition: none;
        }
        .finder-list-row[data-hidden] { opacity: 0.55; }
        .finder-list-name { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .finder-list-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .finder-alias { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
        .finder-list-cell { overflow: hidden; text-overflow: ellipsis; color: var(--deckit-muted); }
        .finder-list-size {
            padding-right: 8px;
            color: var(--deckit-muted);
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .finder-list-message { padding: 18px 8px; color: var(--deckit-muted); }
        .finder-screen { position: absolute; inset: 0; }
    `;
    const rowStates = new WeakMap(); // row element -> { setActive, look }
    let shown = COLUMNS;
    let selected = null;

    const header = ui.element('div', { className: 'finder-list-header' });
    const rows = ui.list({ key: (entry) => entry.path, create: createRow, update: updateRow });
    const notice = ui.element('div');
    const element = ui.element('div');

    ui.addStyle(STYLE);
    element.append(rows.element, notice);

    return { element, header, fit, draw, select };

    // Whether the columns shown changed, for a view `width` wide.
    function fit(width) {
        const next = COLUMNS.filter(
            (column) =>
                (column.key !== 'kind' || width >= SHOWS_KIND_FROM) &&
                (column.key !== 'size' || width >= SHOWS_SIZE_FROM)
        );
        if (next.length === shown.length) return false;
        shown = next;
        return true;
    }

    // `failure` is { title, hint, permission }; `hasHidden` says an empty folder holds hidden entries.
    function draw({ folder, loading, failure, entries, selected: path, sortOrder, filtering, hasHidden }) {
        selected = path;
        drawHeader(sortOrder);
        const listed = !loading && !failure;
        if (listed) icons.request(entries);
        rows.set(listed ? entries : []);
        if (loading) notice.replaceChildren(message('Loading…'));
        else if (failure) notice.replaceChildren(failureScreen(failure));
        else if (!entries.length && filtering) notice.replaceChildren(message('Nothing here matches'));
        else if (!entries.length && folder) notice.replaceChildren(emptyScreen(folder, hasHidden));
        else notice.replaceChildren();
    }

    // Marks the row of `path` in place, the rows kept as they are.
    function select(path) {
        selected = path;
        for (const row of rows.element.children) rowStates.get(row).setActive(row.dataset.path === path);
    }

    function drawHeader(sortOrder) {
        header.style.gridTemplateColumns = template();
        header.replaceChildren(
            ...shown.map((column) => {
                const sorted = sortOrder.key === column.key;
                const cell = ui.element('button', { className: 'finder-sort' });
                cell.type = 'button';
                cell.title = 'Sort by ' + column.label.toLowerCase();
                cell.toggleAttribute('data-right', !!column.right);
                cell.toggleAttribute('data-sorted', sorted);
                cell.append(ui.element('span', { className: 'finder-sort-label', text: column.label }));
                if (sorted) {
                    const caret = ui.element('span', { className: 'finder-sort-caret' });
                    caret.innerHTML = ui.icon(sortOrder.up ? 'chevronUp' : 'chevronDown', { size: 12 });
                    cell.append(caret);
                }
                cell.addEventListener('click', () => onSort(column.key));
                return cell;
            })
        );
    }

    function createRow(entry) {
        const row = ui.row({ size: 'small' });
        row.element.classList.add('finder-list-row');
        row.element.dataset.path = entry.path;
        rowStates.set(row.element, { setActive: row.setActive, look: '' });
        updateRow(row.element, entry);
        return row.element;
    }

    // Filled again only when what it shows changed, so a row under the pointer or being dragged stays as it is.
    function updateRow(element, entry) {
        const state = rowStates.get(element);
        const look = JSON.stringify([
            entry.name,
            entry.kind,
            entry.link,
            entry.hidden,
            formatDate(entry.mtime),
            formatSize(entry),
            formatKind(entry),
            icons.urlOf(entry),
            template(),
        ]);
        if (look !== state.look) {
            state.look = look;
            fillRow(element, entry);
        }
        state.setActive(entry.path === selected);
    }

    function fillRow(element, entry) {
        const name = ui.element('div', { className: 'finder-list-name' });
        const label = ui.element('span', { className: 'finder-list-label', text: entry.name });
        label.dataset.name = '';
        name.append(icons.imageOf(entry), label);
        if (entry.link) {
            const arrow = ui.element('span', { className: 'finder-alias' });
            arrow.innerHTML = ui.icon('externalWindow', { size: 11 });
            arrow.title = 'Alias';
            name.append(arrow);
        }
        const cells = {
            name,
            mtime: ui.element('div', { className: 'finder-list-cell', text: formatDate(entry.mtime) }),
            size: ui.element('div', { className: 'finder-list-size', text: formatSize(entry) }),
            kind: ui.element('div', { className: 'finder-list-cell', text: formatKind(entry) }),
        };
        element.style.gridTemplateColumns = template();
        element.toggleAttribute('data-hidden', entry.hidden);
        element.replaceChildren(...shown.map((column) => cells[column.key]));
    }

    function template() {
        return shown.map((column) => (column.width ? column.width + 'px' : 'minmax(0, 1fr)')).join(' ');
    }

    function message(text) {
        return ui.element('div', { className: 'finder-list-message', text });
    }

    function failureScreen(failure) {
        const actions = [];
        if (failure.permission)
            actions.push(
                ui.button({ label: 'Open Privacy Settings', title: '', onClick: onPrivacySettings, size: 'small' })
                    .element
            );
        return screenOf({ title: failure.title, hint: failure.hint, actions });
    }

    function emptyScreen(folder, hasHidden) {
        const actions = [];
        if (hasHidden) {
            const showHidden = ui.button({
                label: 'Show Hidden Files',
                title: '',
                onClick: onShowHidden,
                size: 'small',
            });
            ui.tooltip(showHidden.element, { text: 'Show hidden files', chord: () => chordOf('hidden') });
            actions.push(showHidden.element);
        }
        actions.push(
            ui.button({ label: 'Show in Finder', title: '', onClick: () => onReveal(folder), size: 'small' }).element
        );
        return screenOf({
            title: 'This folder is empty',
            hint: hasHidden ? 'What is in it is hidden.' : '',
            actions,
        });
    }

    function screenOf(options) {
        const screen = ui.emptyState({ icon: ui.icon('folder', { size: 44 }), ...options }).element;
        screen.classList.add('finder-screen');
        return screen;
    }
}
