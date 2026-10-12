// The bar over the files: back, forward and the enclosing folder, the path, the favorite star, the view menu and the
// filter. A press reports what it asks for; the owner sets what the bar shows. `onToggleFavorite()` answers whether
// it did, and the star then pulses.
function toolbar({
    ui,
    theme,
    chordOf,
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
    const STAR_PULSE_MS = 220;
    const STYLE = `
        .finder-toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            flex: 0 0 auto;
            min-height: 30px;
            padding: 10px 12px 8px;
        }
        .finder-toolbar .deckit-breadcrumb { margin: 0 6px; }
        .finder-toolbar .finder-view-button[data-size] { width: auto; padding: 0 5px; }
        .finder-view-icon { display: flex; align-items: center; gap: 1px; }
        .finder-toolbar .finder-filter { flex: 0 1 200px; min-width: 120px; }
    `;
    let view = null;

    const element = ui.element('div', { className: 'finder-toolbar' });
    const back = ui.iconButton({
        icon: ui.icon('chevronLeft', { size: 16 }),
        title: 'Back',
        onClick: onBack,
        size: 'small',
    });
    const forward = ui.iconButton({
        icon: ui.icon('chevronRight', { size: 16 }),
        title: 'Forward',
        onClick: onForward,
        size: 'small',
    });
    const up = ui.iconButton({
        icon: ui.icon('arrowUp', { size: 15 }),
        title: 'Enclosing folder',
        onClick: onUp,
        size: 'small',
    });
    const crumbs = ui.breadcrumb({ onGo: onCrumb });
    const star = ui.iconButton({
        icon: starIcon(false),
        title: 'Add to Favorites',
        onClick: toggleFavorite,
        size: 'small',
    });
    const viewButton = ui.iconButton({ icon: '', title: 'View', onClick: showViews, size: 'small' });
    const filter = ui.field({
        placeholder: 'Filter this folder',
        size: 'small',
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
    viewButton.element.classList.add('finder-view-button');
    filter.element.classList.add('finder-filter');
    element.append(
        back.element,
        forward.element,
        up.element,
        crumbs.element,
        star.element,
        viewButton.element,
        filter.element
    );

    return {
        element,
        crumbs: crumbs.element,
        setPath: crumbs.set,
        setNavigation,
        setFavorite,
        setView,
        setFilter: filter.set,
        focusFilter: filter.focus,
    };

    function setNavigation({ canGoBack, canGoForward, canGoUp }) {
        back.setEnabled(canGoBack);
        forward.setEnabled(canGoForward);
        up.setEnabled(canGoUp);
    }

    function setFavorite(on) {
        star.setIcon(starIcon(on));
        star.element.title = on ? 'Remove from Favorites' : 'Add to Favorites';
    }

    function setView(next) {
        view = next;
        const icon = ui.icon(VIEWS.find((each) => each.key === view).icon, { size: 14 });
        viewButton.setIcon(`<span class="finder-view-icon">${icon}${ui.icon('chevronDown', { size: 10 })}</span>`);
    }

    function toggleFavorite() {
        if (!onToggleFavorite() || !theme.motion.fast) return;
        star.element.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], {
            duration: STAR_PULSE_MS,
            easing: theme.motion.easing,
        });
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
        return ui.icon('star', { size: 15, fill: on ? 'currentColor' : 'none' });
    }
}
