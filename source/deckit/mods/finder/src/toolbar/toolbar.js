const { nameOf, parentOf } = require('../path/path.js');

// The bar over the files: back, forward and the enclosing folder, the path, the favorite star, the view menu and the
// filter. A press reports what it asks for; the caller sets what the bar shows, the star in the accent while the
// folder is a favorite. Where the bar is narrow the filter gives way first, down to FILTER_LEAST, then folds into a
// button that opens it, so the shown folder's name is cut only when nothing else is left to give.
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
    const FILTER_LEAST = 120;
    // What the folded path puts before the shown folder's name: the "…" and its separator.
    const FOLDED = 40;
    const STYLE = `
        .finder-toolbar .finder-breadcrumb { flex: 1 1 0; margin: 0 6px; }
        .finder-toolbar .finder-view-button { width: auto; padding: 0 5px; }
        .finder-view-icon { display: flex; align-items: center; gap: 1px; }
        .finder-toolbar .finder-filter { flex: 0 1 200px; min-width: ${FILTER_LEAST}px; }
        .finder-toolbar:not([data-folded]) .finder-search-button,
        .finder-toolbar[data-folded]:not([data-searching]) .finder-filter { display: none; }
    `;
    let view = null;
    let depth = 0; // how many parts the path has

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
    const search = ui.iconButton({
        icon: ui.icon('search', { size: 16 }),
        title: 'Filter this folder',
        onClick: () => focusFilter(),
    });

    ui.addStyle(STYLE);
    ui.tooltip(back.element, { text: 'Back', chord: () => chordOf('back') });
    ui.tooltip(forward.element, { text: 'Forward', chord: () => chordOf('forward') });
    ui.tooltip(up.element, { text: 'Enclosing folder', chord: () => chordOf('enclosing') });
    ui.tooltip(search.element, { text: 'Filter this folder', chord: () => chordOf('filter') });
    breadcrumb.element.classList.add('finder-breadcrumb');
    viewButton.element.classList.add('finder-view-button');
    filter.element.classList.add('finder-filter');
    search.element.classList.add('finder-search-button');
    filter.input.addEventListener('blur', () => {
        if (!filter.input.value) element.removeAttribute('data-searching');
    });
    element.append(
        back.element,
        forward.element,
        up.element,
        breadcrumb.element,
        star.element,
        viewButton.element,
        search.element,
        filter.element
    );
    new ResizeObserver(fit).observe(element);

    return {
        element,
        folderAt,
        setPath,
        setNavigation,
        setFavorite,
        setView,
        setFilter,
        focusFilter,
    };

    function focusFilter() {
        element.setAttribute('data-searching', '');
        filter.focus();
    }

    function setFilter(text) {
        filter.set(text);
        if (!text && filter.input !== filter.input.ownerDocument.activeElement)
            element.removeAttribute('data-searching');
    }

    // The path keeps room for the shown folder's name while the filter can give it; past that the filter folds.
    function fit() {
        const current = breadcrumb.element.querySelector('[aria-current="page"]');
        const name = current ? widthOf(current) + (depth > 1 ? FOLDED : 0) : 0;
        const style = getComputedStyle(element);
        const path = getComputedStyle(breadcrumb.element);
        const fixed = [back, forward, up, star, viewButton].reduce((sum, each) => sum + each.element.offsetWidth, 0);
        const parts = 7; // what the bar holds while the filter is out: the path, the filter and the five buttons
        const room =
            element.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight) -
            fixed -
            (parts - 1) * parseFloat(style.columnGap) -
            parseFloat(path.marginLeft) -
            parseFloat(path.marginRight);
        const folded = room < name + FILTER_LEAST;
        element.toggleAttribute('data-folded', folded);
        breadcrumb.element.style.minWidth = folded ? '' : name + 'px';
    }

    // The width `crumb` takes uncut: a cut one answers its cut width to scrollWidth.
    function widthOf(crumb) {
        const kept = crumb.style.cssText;
        Object.assign(crumb.style, { flex: 'none', width: 'max-content' });
        const width = crumb.offsetWidth;
        crumb.style.cssText = kept;
        return width;
    }

    // From `shown` up to the home folder when it is inside it, or else up to the disk's root.
    function setPath(shown) {
        const folders = [];
        for (let folder = shown; folder; folder = parentOf(folder)) {
            folders.unshift(folder);
            if (folder === homeLocation()) break;
        }
        depth = folders.length;
        breadcrumb.set(
            folders.map((folder, index) => ({
                key: folder,
                label: nameOf(folder),
                title: tildify(folder),
                icon: 'folder',
                current: index === folders.length - 1,
            }))
        );
        fit();
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
