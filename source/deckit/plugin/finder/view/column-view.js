// The folders from the tab's down to the pick, side by side, and a preview of a picked file after them. A column
// keeps its scroll while it stays, and a width the person drags, kept per tab. `onResize(tab, folder, width)` hears
// one let go.
function columnView({ ui, icons, entryAt, onResize }) {
    const COLUMN_MIN = 140;
    const COLUMN_MAX = 640;
    const COLUMN_WIDTH = 230;
    // The size of the system's icons: drawn larger, they blur.
    const PREVIEW_ICON_SIZE = 32;
    // The view and its list of columns lend their place to what is in them: the columns and the preview lay out as
    // the file area's own flex items. A cell's rule sits under the column's body to outweigh the kit row's own size.
    const STYLE = `
        .finder-columns,
        .finder-column-list { display: contents; }
        .finder-column { position: relative; height: 100%; border-right: var(--deckit-border); }
        .finder-column-body { height: 100%; box-sizing: border-box; overflow-y: auto; padding: 4px 6px; }
        .finder-column-edge {
            position: absolute;
            top: 0;
            bottom: 0;
            right: -4px;
            z-index: 1;
            width: 8px;
            cursor: col-resize;
        }
        .finder-column-cell { cursor: default; transition: none; }
        .finder-column-cell[data-hidden] { opacity: 0.55; }
        .finder-column-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .finder-column-more { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
        .finder-column-message { padding: 8px 6px; color: var(--deckit-muted); }
        .finder-column-message:empty { display: none; }
        .finder-preview {
            display: flex;
            flex: 1 0 240px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            height: 100%;
            box-sizing: border-box;
            padding: 16px;
            text-align: center;
        }
        .finder-preview-name { margin-top: 10px; font: 600 var(--deckit-type-body); overflow-wrap: anywhere; }
        .finder-preview-detail { color: var(--deckit-muted); }
        .finder-thumbnail { max-width: 100%; max-height: min(240px, 50%); object-fit: contain; border-radius: 4px; }
    `;
    const columnParts = new WeakMap(); // column element -> { rows, message }
    const cellParts = new WeakMap(); // cell element -> its row
    let drawn = { tab: null, widths: {}, folders: new Map(), selected: null };
    // The column being resized and its tab: a redraw meanwhile leaves its width alone, and the width is saved to that
    // tab even if another is in front by then.
    let sizing = null;
    let preview = null;

    const element = ui.element('div', { className: 'finder-columns' });
    const columns = ui.list({ key: (folder) => folder, create: createColumn, update: updateColumn });

    ui.addStyle(STYLE);
    columns.element.classList.add('finder-column-list');
    element.append(columns.element);

    return { element, foldersOf, draw, endElement, folderAt };

    // The tab's folder, and each folder on the way down to the pick, the pick too when it is a folder.
    function foldersOf(location, selected) {
        if (!location) return [];
        const folders = [location];
        if (!selected || !isInside(selected, location)) return folders;
        const steps = stepsFrom(location, selected);
        let path = location;
        steps.forEach((name, index) => {
            path = childOf(path, name);
            if (index < steps.length - 1 || entryAt(path)?.kind === 'folder') folders.push(path);
        });
        return folders;
    }

    // `tab` is the tab drawn, for whom a resize is; `widths` its column widths by folder. `folders` are { folder,
    // listing, entries, filtering }; `previewed` is the picked file, or null.
    function draw({ tab, widths, folders, selected, previewed }) {
        drawn = { tab, widths, selected, folders: new Map(folders.map((column) => [column.folder, column])) };
        for (const { listing, entries } of folders) if (listing && !listing.failure) icons.request(entries);
        columns.set(folders.map((column) => column.folder));
        preview?.remove();
        preview = previewed ? previewOf(previewed) : null;
        if (preview) element.append(preview);
    }

    // What is drawn last: the preview, or else the last column.
    function endElement() {
        return preview || columns.element.lastElementChild;
    }

    // The folder of the column or the preview under `under`: the preview stands for the picked file, in the last
    // column's folder.
    function folderAt(under) {
        const column = under.closest('[data-folder], [data-preview]');
        if (column?.dataset.folder) return { folder: column.dataset.folder, mark: column };
        if (!column) return null;
        const folder = parentOf(column.dataset.preview);
        return { folder, mark: columns.elementOf(folder) || column };
    }

    function createColumn(folder) {
        const column = ui.element('div', { className: 'finder-column' });
        column.dataset.folder = folder;
        setWidth(column, widthOf(folder));
        // Rows scroll in a body of their own so the resize edge stays put.
        const body = ui.element('div', { className: 'finder-column-body' });
        const rows = ui.list({ key: (entry) => entry.path, create: createCell, update: updateCell });
        const message = ui.element('div', { className: 'finder-column-message' });
        body.append(rows.element, message);
        column.append(body, edgeOf(column, folder));
        columnParts.set(column, { rows, message });
        fillColumn(column, folder);
        return column;
    }

    // A column kept from another tab of the same folder takes this tab's width.
    function updateColumn(column, folder) {
        if (!(sizing?.column === column && sizing.tab === drawn.tab)) setWidth(column, widthOf(folder));
        fillColumn(column, folder);
    }

    function fillColumn(column, folder) {
        const { listing, entries, filtering } = drawn.folders.get(folder);
        const { rows, message } = columnParts.get(column);
        rows.set(listing && !listing.failure ? entries : []);
        if (!listing) message.textContent = 'Loading…';
        else if (listing.failure) message.textContent = listing.failure.title;
        else if (!entries.length) message.textContent = filtering ? 'Nothing here matches' : 'Empty';
        else message.textContent = '';
    }

    function edgeOf(column, folder) {
        const handle = ui.element('div', { className: 'finder-column-edge' });
        handle.title = 'Drag to resize';
        ui.resizer(handle, {
            axis: 'x',
            size: () => column.getBoundingClientRect().width,
            min: COLUMN_MIN,
            max: COLUMN_MAX,
            // Held from the drag's start until commit, the spring back included.
            onDrag: (on) => {
                if (on) sizing = { column, tab: drawn.tab };
            },
            onResize: (width) => {
                if (sizing?.tab === drawn.tab) setWidth(column, width);
            },
            onCommit: (width) => {
                const tab = sizing?.tab;
                sizing = null;
                if (tab) onResize(tab, folder, Math.round(width));
            },
        });
        return handle;
    }

    function widthOf(folder) {
        return drawn.widths[folder] ?? COLUMN_WIDTH;
    }

    function setWidth(column, width) {
        column.style.flex = `0 0 ${Math.round(width)}px`;
    }

    // Presses are handled by the file area, which tells a double click even across a redraw.
    function createCell(entry) {
        const cell = ui.row({ size: 'small' });
        cell.element.classList.add('finder-column-cell');
        cell.element.dataset.path = entry.path;
        cellParts.set(cell.element, cell);
        updateCell(cell.element, entry);
        return cell.element;
    }

    // A folder on the way to the pick is marked with it.
    function updateCell(element, entry) {
        refillWhenChanged(element, [entry.name, entry.kind, entry.hidden, icons.urlOf(entry)], () =>
            fillCell(element, entry)
        );
        const { selected } = drawn;
        cellParts
            .get(element)
            .setActive(!!selected && (selected === entry.path || selected.startsWith(entry.path + '/')));
    }

    function fillCell(element, entry) {
        const label = ui.element('span', { className: 'finder-column-label', text: entry.name });
        label.dataset.name = '';
        element.toggleAttribute('data-hidden', entry.hidden);
        element.replaceChildren(icons.imageOf(entry), label);
        if (entry.kind !== 'folder') return;
        const more = ui.element('span', { className: 'finder-column-more' });
        more.innerHTML = ui.icon('chevronRight', { size: 12 });
        element.append(more);
    }

    function previewOf(entry) {
        const shown = ui.element('div', { className: 'finder-preview' });
        shown.dataset.preview = entry.path;
        const known = icons.cachedThumbnail(entry);
        const picture = known ? thumbnailOf(known) : icons.imageOf(entry, PREVIEW_ICON_SIZE);
        if (known === undefined)
            icons.thumbnail(entry).then((url) => {
                if (url && shown.isConnected) picture.replaceWith(thumbnailOf(url));
            });
        shown.append(
            picture,
            ui.element('div', { className: 'finder-preview-name', text: entry.name }),
            ui.element('div', {
                className: 'finder-preview-detail',
                text: formatKind(entry) + (entry.size == null ? '' : ' · ' + formatSize(entry)),
            }),
            ui.element('div', { className: 'finder-preview-detail', text: formatDate(entry.mtime) })
        );
        return shown;
    }

    function thumbnailOf(url) {
        const image = ui.element('img', { className: 'finder-thumbnail' });
        image.src = url;
        image.draggable = false;
        return image;
    }
}
