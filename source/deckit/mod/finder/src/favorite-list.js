const { nameOf } = require('./path.js');
const { sidebarRow } = require('./sidebar-row.js');

// Favorites, the folders the person keeps at hand in the sidebar. They start as the system's places (Home, Desktop and
// the rest) and are the person's to add to, remove and order. The row of `currentLocation()` is lit; `onDraw()`
// hears the favorites drawn.
function favoriteList({ ui, reveal, show, records, tildify, folds, currentLocation, onGo, onOpenInNewTab, onDraw }) {
    const PLACE_ICONS = {
        home: 'home',
        desktop: 'monitor',
        documents: 'fileText',
        downloads: 'download',
        applications: 'grid',
    };
    const rowParts = new WeakMap(); // row element -> sidebar row
    let places = []; // { id, label, path }

    const section = ui.section({
        label: 'Favorites',
        icon: ui.icon('star', { size: 16 }),
        collapsed: folds.has('favorites'),
        onToggle: (collapsed) => {
            section.setCollapsed(collapsed);
            folds.set('favorites', collapsed);
        },
    });
    const rows = ui.list({ key: (path) => path, create: createRow, update: updateRow, animated: true });

    section.body.append(rows.element);
    ui.sortable(rows, {
        onReorder: (path, toPath) => {
            const list = paths();
            const from = list.indexOf(path);
            const to = list.indexOf(toPath);
            if (from < 0 || to < 0) return;
            list.splice(from, 1);
            list.splice(to, 0, path);
            set(list);
        },
    });
    ui.contextMenu(rows.element, {
        rowAt: (target) => target.closest('[data-path]'),
        items: (row) => {
            const path = row?.dataset.path;
            if (!path) return null;
            const missing = missingPlaces();
            return [
                { label: 'Open in New Tab', icon: 'window', hint: '⌘', run: () => onOpenInNewTab(path) },
                { label: 'Show in Finder', icon: 'folder', run: () => reveal(path) },
                '-',
                { label: 'Remove from Favorites', icon: 'x', run: () => remove(path) },
                ...(missing.length
                    ? [
                          {
                              label: 'Restore System Places',
                              icon: 'reload',
                              run: () => set([...missing.map((place) => place.path), ...paths()]),
                          },
                      ]
                    : []),
            ];
        },
    });

    return {
        element: section.element,
        folderAt,
        paths,
        has,
        add,
        remove,
        draw,
        relocate,
        setPlaces,
        places: () => places,
        placeOf,
        placePath: (id) => places.find((place) => place.id === id)?.path,
        labelOf,
        iconNameOf,
    };

    // The folder of the favorite row under `under`, for a drop.
    function folderAt(under) {
        const row = under.closest('[data-path]');
        return row ? { folder: row.dataset.path, mark: row } : null;
    }

    function paths() {
        return records.get('favorites', null) ?? places.map((place) => place.path);
    }

    function has(path) {
        return paths().includes(path);
    }

    function add(path) {
        if (!has(path)) set([...paths(), path]);
    }

    function remove(path) {
        set(paths().filter((other) => other !== path));
    }

    function set(list) {
        records.set('favorites', [...new Set(list)]);
        draw();
    }

    function draw() {
        rows.set(paths());
        onDraw();
    }

    // `follow(path)` is where a path went, null when it is gone.
    function relocate(follow) {
        const list = paths();
        if (list.some((path) => follow(path) !== path)) set(list.map(follow).filter(Boolean));
    }

    function setPlaces(list) {
        places = list;
        draw();
    }

    function placeOf(path) {
        return places.find((place) => place.path === path);
    }

    function labelOf(path) {
        return placeOf(path)?.label ?? nameOf(path);
    }

    function iconNameOf(path) {
        return PLACE_ICONS[placeOf(path)?.id] || 'folder';
    }

    function missingPlaces() {
        const kept = paths();
        return places.filter((place) => !kept.includes(place.path));
    }

    function createRow(path) {
        const row = sidebarRow(ui);
        row.element.dataset.path = path;
        row.element.append(
            ui.rowAction({
                icon: ui.icon('x', { size: 14 }),
                title: 'Remove from Favorites',
                onClick: () => remove(path),
            }).element
        );
        row.element.addEventListener('click', (event) => {
            show();
            if (event.metaKey) onOpenInNewTab(path);
            else onGo(path);
        });
        rowParts.set(row.element, row);
        updateRow(row.element, path);
        return row.element;
    }

    function updateRow(element, path) {
        const row = rowParts.get(element);
        row.set({ icon: iconNameOf(path), label: labelOf(path), title: tildify(path) });
        row.setActive(path === currentLocation());
    }
}

module.exports = { favoriteList };
