const { nameOf, parentOf } = require('../path/path.js');

// The bar over the files: back, forward and the enclosing folder, the path, the favorite star, the view menu and the
// filter. A press reports what it asks for; the caller sets what the bar shows, the star in the accent while the
// folder is a favorite.
function toolbar({
    ui,
    chordOf,
    tildify,
    homeLocation,
    onBack,
    onForward,
    onUp,
    onCrumb,
    onToggleFavorite,
    onView,
    onFilter,
    onFilterSubmit,
    onFilterCancel,
}) {
    const VIEWS = [
        { key: 'columns', label: 'As Columns', icon: 'columns', action: 'columnView' },
        { key: 'list', label: 'As List', icon: 'list', action: 'listView' },
    ];
    const STYLE = `
        .finder-breadcrumb { margin: 0 6px; }
        .finder-toolbar .finder-view-button { width: auto; padding: 0 5px; }
        .finder-view-icon { display: flex; align-items: center; gap: 1px; }
        .finder-toolbar .finder-filter { flex: 0 1 200px; min-width: 120px; }
    `;
    let view = null;

    const element = ui.element('div', { className: 'finder-toolbar' });
    ui.titleBar(element);
    const back = ui.iconButton({
        icon: ui.icon('chevronLeft', { size: 16 }),
        title: 'Back',
        onClick: onBack,
    });
    const forward = ui.iconButton({
        icon: ui.icon('chevronRight', { size: 16 }),
        title: 'Forward',
        onClick: onForward,
    });
    const up = ui.iconButton({
        icon: ui.icon('arrowUp', { size: 16 }),
        title: 'Enclosing folder',
        onClick: onUp,
    });
    const breadcrumb = ui.breadcrumb({ onGo: onCrumb });
    const star = ui.iconButton({
        icon: starIcon(false),
        title: 'Add to Favorites',
        onClick: () => onToggleFavorite(),
    });
    const viewButton = ui.iconButton({ icon: '', title: 'View', onClick: showViews });
    const filter = ui.field({
        placeholder: 'Filter this folder',
        icon: ui.icon('search', { size: 13 }),
        clearable: true,
        onInput: onFilter,
        onSubmit: onFilterSubmit,
        onCancel: onFilterCancel,
    });

    ui.addStyle(STYLE);
    ui.tooltip(back.element, { text: 'Back', chord: () => chordOf('back') });
    ui.tooltip(forward.element, { text: 'Forward', chord: () => chordOf('forward') });
    ui.tooltip(up.element, { text: 'Enclosing folder', chord: () => chordOf('enclosing') });
    breadcrumb.element.classList.add('finder-breadcrumb');
    viewButton.element.classList.add('finder-view-button');
    filter.element.classList.add('finder-filter');
    element.append(
        back.element,
        forward.element,
        up.element,
        breadcrumb.element,
        star.element,
        viewButton.element,
        filter.element
    );

    return {
        element,
        folderAt,
        setPath,
        setNavigation,
        setFavorite,
        setView,
        setFilter: filter.set,
        focusFilter: filter.focus,
    };

    // From `shown` up to the home folder when it is inside it, or else up to the disk's root.
    function setPath(shown) {
        const folders = [];
        for (let folder = shown; folder; folder = parentOf(folder)) {
            folders.unshift(folder);
            if (folder === homeLocation()) break;
        }
        breadcrumb.set(
            folders.map((folder, index) => ({
                key: folder,
                label: nameOf(folder),
                title: tildify(folder),
                icon: 'folder',
                current: index === folders.length - 1,
            }))
        );
    }

    // The folder of the path's part under `under`, for a drop.
    function folderAt(under) {
        const part = breadcrumb.partAt(under);
        return part ? { folder: part.key, mark: part.element } : null;
    }

    function setNavigation({ canGoBack, canGoForward, canGoUp }) {
        back.setEnabled(canGoBack);
        forward.setEnabled(canGoForward);
        up.setEnabled(canGoUp);
    }

    function setFavorite(on) {
        star.setIcon(starIcon(on));
        star.setPressed(on);
        star.element.title = on ? 'Remove from Favorites' : 'Add to Favorites';
    }

    function setView(next) {
        view = next;
        const icon = ui.icon(VIEWS.find((each) => each.key === view).icon, { size: 16 });
        viewButton.setIcon(`<span class="finder-view-icon">${icon}${ui.icon('chevronDown', { size: 10 })}</span>`);
    }

    function showViews() {
        ui.menu({
            items: VIEWS.map((each) => ({
                label: each.label,
                icon: each.icon,
                hint: chordOf(each.action),
                checked: each.key === view,
                run: () => onView(each.key),
            })),
            anchor: viewButton.element,
        });
    }

    function starIcon(on) {
        return ui.icon('star', { size: 16, fill: on ? 'currentColor' : 'none' });
    }
}

module.exports = { toolbar };
