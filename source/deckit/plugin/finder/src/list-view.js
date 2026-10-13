const { formatKind, formatSize, formatDate } = require('./format.js');
const { refillWhenChanged } = require('./refill-when-changed.js');

// A folder as rows under a header that sorts them. Narrow, it drops the Kind column and then the Size column.
function listView({ ui, icons, onSort }) {
    const COLUMNS = [
        { key: 'name', label: 'Name' },
        { key: 'mtime', label: 'Date Modified', width: 150 },
        { key: 'size', label: 'Size', width: 76, right: true },
        { key: 'kind', label: 'Kind', width: 120 },
    ];
    const SHOWS_KIND_FROM = 620;
    const SHOWS_SIZE_FROM = 470;
    // A row's rule sits under the list to outweigh the gap of the kit's small row: its columns are the header's.
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
        .finder-list .finder-list-row {
            display: grid;
            gap: 0;
            cursor: default;
            transition: none;
        }
        .finder-list-row[data-hidden] { opacity: 0.55; }
        .finder-list-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .finder-list-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .finder-alias { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
        .finder-list-cell { overflow: hidden; text-overflow: ellipsis; color: var(--deckit-muted); }
        .finder-list-size {
            padding-right: 8px;
            color: var(--deckit-muted);
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
    `;
    const rowParts = new WeakMap(); // row element -> its row
    let shown = COLUMNS;
    let selection = new Set();

    const header = ui.element('div', { className: 'finder-list-header' });
    const rows = ui.list({ key: (entry) => entry.path, create: createRow, update: updateRow });
    const element = rows.element;

    ui.addStyle(STYLE);
    element.classList.add('finder-list');

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

    function draw({ entries, selection: paths, sortOrder }) {
        selection = new Set(paths);
        drawHeader(sortOrder);
        icons.request(entries);
        rows.set(entries);
    }

    // Marks the rows of `paths` in place, the rows kept as they are.
    function select(paths) {
        selection = new Set(paths);
        for (const row of rows.element.children) rowParts.get(row).setActive(selection.has(row.dataset.path));
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
        rowParts.set(row.element, row);
        updateRow(row.element, entry);
        return row.element;
    }

    function updateRow(element, entry) {
        const signature = [
            entry.name,
            entry.kind,
            entry.link,
            entry.hidden,
            formatDate(entry.mtime),
            formatSize(entry),
            formatKind(entry),
            icons.urlOf(entry),
            template(),
        ];
        refillWhenChanged(element, signature, () => fillRow(element, entry));
        rowParts.get(element).setActive(selection.has(entry.path));
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
}

module.exports = { listView };
