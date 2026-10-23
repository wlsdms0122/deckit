const { nameOf, parentOf } = require('../path/path.js');
const { sidebarRow } = require('./sidebar-row.js');

// The tabs, each at a location with its own history, selection, filter and column widths, listed in the sidebar; closed
// ones are kept to reopen. A tab's location is where its columns start, and its folder the one in front,
// `folderInFront(location, opened)`: a tab is named for its folder, and what is done to the tab as a place (a drop on
// it, a new tab) is done there. A selection is entries of one folder: the lead, the one the keys follow, and the anchor
// a range is drawn from. The columns are opened down to the lead, or to the folder of several, unless a rectangle that
// selected them left a path deeper open. This list alone writes a tab; the others read the tab in front
// through its queries and change it through its setters. A tab coming in front or going somewhere is given what to do
// once its folder is read ({ select, scroll }, taken with `takeWhenRead()`), and `onEnter()` hears it; `onLeave()`
// hears the tab in front about to give its place.
function tabList({
    ui,
    chordOf,
    reveal,
    records,
    tildify,
    folds,
    homeLocation,
    folderInFront,
    isFavorite,
    onAddFavorite,
    onLeave,
    onEnter,
}) {
    const CLOSED_KEPT = 10;
    const WIDTHS_KEPT = 64;
    const saved = records.get('tabs', null);
    const tabs = [];
    const closed = [...(saved?.closed ?? [])];
    const rowParts = new WeakMap(); // row element -> sidebar row
    let front = null;
    let lastId = 0;

    const section = ui.section({
        label: 'Tabs',
        icon: ui.icon('window', { size: 16 }),
        actions: [{ title: 'New tab', run: () => open() }],
        collapsed: folds.has('tabs'),
        onToggle: (collapsed) => {
            section.setCollapsed(collapsed);
            folds.set('tabs', collapsed);
        },
    });
    const rows = ui.list({ key: (tab) => tab.id, create: createRow, update: updateRow, animated: true });

    ui.tooltip(section.actions[0].element, { text: 'New tab', chord: () => chordOf('newTab') });
    section.body.append(rows.element);
    ui.sortable(rows, {
        onReorder: (id, toId) => {
            const from = tabs.findIndex((tab) => tab.id === id);
            const to = tabs.findIndex((tab) => tab.id === toId);
            if (from < 0 || to < 0) return;
            const [tab] = tabs.splice(from, 1);
            tabs.splice(to, 0, tab);
            persist();
        },
    });
    ui.contextMenu(rows.element, {
        rowAt: (target) => target.closest('[data-tab-id]'),
        items: (row) => {
            const tab = row && tabOf(row);
            if (!tab) return null;
            const folder = folderOf(tab);
            return [
                { label: 'Close Tab', icon: 'x', run: () => close(tab) },
                { label: 'Close Other Tabs', disabled: tabs.length < 2, run: () => closeOthers(tab) },
                '-',
                {
                    label: 'Add to Favorites',
                    icon: 'star',
                    disabled: isFavorite(folder),
                    run: () => onAddFavorite(folder),
                },
                { label: 'Show in Finder', icon: 'folder', run: () => reveal(folder) },
            ];
        },
    });

    return {
        element: section.element,
        front: () => front,
        location: () => front?.location ?? null,
        selectedPath: () => front?.selected ?? null,
        selection: () => front?.selection ?? [],
        anchor: () => front?.anchor ?? null,
        opened: () => front?.opened ?? null,
        filter: () => ({ text: front?.filter ?? '', folder: front?.filterFolder ?? null }),
        widths: () => front?.widths ?? {},
        canGoBack: () => !!front?.back.length,
        canGoForward: () => !!front?.forward.length,
        locations: () => tabs.map((tab) => tab.location),
        leadFolders: () => tabs.filter((tab) => tab.selected).map((tab) => parentOf(tab.selected)),
        folderAt,
        draw,
        select,
        setSelection,
        setFilter,
        clearFilter,
        takeWhenRead,
        keepScroll,
        open,
        show,
        showAt,
        close,
        reopen,
        go,
        back,
        forward,
        up,
        setWidth,
        relocate,
        restore,
        persist,
    };

    // The folder of the tab row under `under`, for a drop.
    function folderAt(under) {
        const row = under.closest('[data-tab-id]');
        const tab = row && tabOf(row);
        const folder = tab && folderOf(tab);
        return folder ? { folder, mark: row } : null;
    }

    // Each tab's name, which follows its selection and the view.
    function draw() {
        rows.set(tabs);
    }

    // The one entry at `path`, or none.
    function select(path) {
        setSelection(path ? [path] : [], { lead: path, anchor: path });
    }

    // `paths` are entries of one folder, `lead` among them; `opened` is a path deeper left open, or null.
    function setSelection(paths, { lead, anchor, opened = null }) {
        front.selection = paths;
        front.selected = lead;
        front.anchor = anchor;
        front.opened = opened ?? (paths.length > 1 ? parentOf(lead) : lead);
        draw();
    }

    function setFilter(text, folder) {
        front.filter = text;
        front.filterFolder = folder;
    }

    function clearFilter() {
        setFilter('', null);
    }

    function takeWhenRead() {
        const whenRead = front.whenRead;
        front.whenRead = null;
        return whenRead;
    }

    function keepScroll(top) {
        front.scroll = top;
    }

    function open(
        location = (front ? folderOf(front) : null) || homeLocation(),
        { background = false, widths = {} } = {}
    ) {
        const tab = {
            id: ++lastId,
            location,
            back: [],
            forward: [],
            selected: null,
            selection: [],
            anchor: null,
            opened: null,
            filter: '',
            filterFolder: null,
            scroll: 0,
            widths,
            whenRead: null,
        };
        tabs.push(tab);
        if (background || !location) persist();
        else show(tab);
        return tab;
    }

    // Showing the tab in front again would read it again and put back the scroll it had when it last left.
    function show(tab) {
        if (tab === front) return;
        if (front) onLeave();
        front = tab;
        return enter(tab, { scroll: tab.scroll });
    }

    function showAt(index) {
        const tab = tabs.at(index);
        if (tab) show(tab);
    }

    function close(tab) {
        const at = tabs.indexOf(tab);
        if (at < 0) return;
        rememberClosed(tab, at);
        trimClosed();
        tabs.splice(at, 1);
        if (tab !== front) return persist();
        front = null;
        if (!tabs.length) return open(homeLocation());
        show(tabs[Math.max(0, at - 1)]);
    }

    // All at once: closing them one by one would bring each neighbour forward on the way.
    function closeOthers(tab) {
        tabs.forEach((other, at) => other !== tab && rememberClosed(other, at));
        trimClosed();
        tabs.splice(0, tabs.length, tab);
        if (tab !== front) show(tab);
        else persist();
    }

    function reopen() {
        const last = closed.pop();
        if (!last) return;
        const tab = open(last.location, { background: true, widths: last.widths });
        const at = tabs.indexOf(tab);
        const wanted = Math.min(last.at, tabs.length - 1);
        if (wanted !== at) tabs.splice(wanted, 0, tabs.splice(at, 1)[0]);
        show(tab);
    }

    function go(location, { from = null, history = true } = {}) {
        const tab = front;
        if (!tab || !location || location === tab.location) return;
        if (history && tab.location) {
            tab.back.push(tab.location);
            tab.forward.length = 0;
        }
        tab.location = location;
        tab.selected = null;
        tab.selection = [];
        tab.anchor = null;
        tab.opened = null;
        tab.filter = '';
        tab.filterFolder = null;
        return enter(tab, { select: from, scroll: from ? 'reveal' : 0 });
    }

    function back() {
        if (!front?.back.length) return;
        front.forward.push(front.location);
        go(front.back.pop(), { history: false });
    }

    function forward() {
        if (!front?.forward.length) return;
        front.back.push(front.location);
        go(front.forward.pop(), { history: false });
    }

    function up() {
        const location = front?.location;
        const enclosing = location && parentOf(location);
        if (enclosing) go(enclosing, { from: location });
    }

    // Put last, so the order of the keys is recency and the oldest go first.
    function setWidth(tab, folder, width) {
        const widths = { ...tab.widths };
        delete widths[folder];
        widths[folder] = width;
        tab.widths = Object.fromEntries(Object.entries(widths).slice(-WIDTHS_KEPT));
        persist();
    }

    // `follow(path)` is where a path went, null when it is gone; a tab whose location is gone goes to `fallback`.
    function relocate(follow, fallback) {
        for (const tab of tabs) {
            tab.location = follow(tab.location) ?? fallback;
            tab.back = followHistory(tab.back, follow);
            tab.forward = followHistory(tab.forward, follow);
            // A selection that went is left as is; the next draw cuts it back once the listings no longer hold it.
            const followed = (path) => path && (follow(path) ?? path);
            tab.selected = followed(tab.selected);
            tab.selection = tab.selection.map(followed);
            tab.anchor = followed(tab.anchor);
            tab.opened = followed(tab.opened);
            tab.widths = followWidths(tab.widths, follow);
        }
        const kept = closed
            .map((tab) => ({ ...tab, location: follow(tab.location), widths: followWidths(tab.widths, follow) }))
            .filter((tab) => tab.location);
        closed.splice(0, closed.length, ...kept);
        persist();
    }

    // Only a folder known to be gone drops its tab: a failed check must not shorten what was left open. `exists(path)`
    // answers 'folder', 'file' or null.
    async function restore(exists) {
        const alive = []; // from: its index in the saved list
        for (const [index, tab] of (saved?.list ?? []).entries()) {
            const kind = await exists(tab.location).catch(() => 'unknown');
            if (kind === 'folder' || kind === 'unknown') alive.push({ ...tab, from: index });
        }
        if (!alive.length) alive.push({ location: homeLocation(), from: 0 });
        const opened = alive.map((tab) => open(tab.location, { background: true, widths: tab.widths }));
        // The tab that was in front, or if it is gone the one before it, where closing it would have landed.
        const was = saved?.front ?? 0;
        let pick = alive.findIndex((tab) => tab.from === was);
        if (pick < 0) pick = Math.max(0, alive.map((tab) => tab.from < was).lastIndexOf(true));
        show(opened[pick]);
    }

    function persist() {
        records.set('tabs', {
            list: tabs.map(({ location, widths }) => ({ location, widths })),
            front: Math.max(0, tabs.indexOf(front)),
            closed,
        });
        draw();
    }

    function enter(tab, whenRead) {
        tab.whenRead = whenRead;
        persist();
        return onEnter();
    }

    function rememberClosed(tab, at) {
        if (tab.location) closed.push({ location: tab.location, at, widths: tab.widths });
    }

    function trimClosed() {
        closed.splice(0, Math.max(0, closed.length - CLOSED_KEPT));
    }

    function tabOf(row) {
        return tabs.find((tab) => String(tab.id) === row.dataset.tabId);
    }

    function folderOf(tab) {
        return folderInFront(tab.location, tab.opened);
    }

    function createRow(tab) {
        const row = sidebarRow(ui);
        row.element.dataset.tabId = String(tab.id);
        const closeButton = ui.rowAction({
            icon: ui.icon('x', { size: 14 }),
            title: 'Close tab',
            onClick: () => close(tab),
        });
        ui.tooltip(closeButton.element, { text: 'Close tab', chord: () => chordOf('closeTab') });
        row.element.append(closeButton.element);
        row.element.addEventListener('click', () => show(tab));
        rowParts.set(row.element, row);
        updateRow(row.element, tab);
        return row.element;
    }

    function updateRow(element, tab) {
        const row = rowParts.get(element);
        const folder = folderOf(tab);
        row.set({
            icon: 'folder',
            label: folder ? nameOf(folder) : '…',
            title: folder ? tildify(folder) : '',
        });
        row.setActive(tab === front);
    }

    // Drops paths that went, and the repeats in a row that leaves.
    function followHistory(paths, follow) {
        return paths
            .map(follow)
            .reduce((kept, path) => (path && path !== kept[kept.length - 1] ? [...kept, path] : kept), []);
    }

    function followWidths(widths, follow) {
        return Object.fromEntries(
            Object.entries(widths).flatMap(([folder, width]) => {
                const to = follow(folder);
                return to ? [[to, width]] : [];
            })
        );
    }
}

module.exports = { tabList };
