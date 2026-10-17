const { columnView } = require('./column-view.js');
const { favoriteList } = require('./favorite-list.js');
const { fileArea } = require('./file-area.js');
const { fileMenu } = require('./file-menu.js');
const { fileOperator } = require('./file-operator.js');
const { folderStatus } = require('./folder-status.js');
const { goToFolder } = require('./go-to-folder.js');
const { iconCache } = require('./icon-cache.js');
const { listView } = require('./list-view.js');
const { listingCache } = require('./listing-cache.js');
const { parentOf, isInside } = require('./path.js');
const { selectionInput } = require('./selection-input.js');
const { tabList } = require('./tab-list.js');
const { toolbar } = require('./toolbar.js');

module.exports = {
    keywords: ['finder', 'files', 'file', 'folder', 'explorer', 'browse', '파인더', '파일', '폴더', '탐색기'],
    //! Lucide "folder" (ISC).
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,

    settings: {
        showHidden: {
            label: 'Show hidden files',
            type: 'toggle',
            default: false,
            hint: 'Names that start with a dot, such as .git or .env.',
        },
        foldersFirst: {
            label: 'Keep folders on top',
            type: 'toggle',
            default: true,
            hint: 'Folders come before files whichever column the list is sorted by.',
        },
    },

    async start(deck) {
        const { theme, ui, storage, settings, util } = deck;
        const { values, records } = storage;
        // Every folder, icon and file change goes through this module, so a finder whose module cannot start does not
        // start either.
        const disk = await deck.mainProcess('main-process/disk.js');
        const STYLE = `
            .finder-content {
                position: relative;
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
            .finder-sidebar { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
        `;
        let home = '';
        let showing = false;

        const folds = {
            has: (key) => !!values.get('folds', {})[key],
            set: (key, collapsed) => values.set('folds', { ...values.get('folds', {}), [key]: collapsed }),
        };
        const content = ui.element('div', { className: 'finder-content' });
        const sidebar = ui.element('div', { className: 'finder-sidebar' });
        const icons = iconCache({ ui, disk, onArrive: () => area.draw() });
        const listings = listingCache({
            about: deck.about,
            disk,
            isShown: (folder) => area.shownFolders().includes(folder),
            onRead: applyListing,
        });
        const tabs = tabList({
            ui,
            chordOf: deck.chordOf,
            reveal: deck.reveal,
            records,
            tildify: util.tildify,
            folds,
            homeLocation: () => home,
            isFavorite: (path) => favorites.has(path),
            onAddFavorite: (path) => favorites.add(path),
            onLeave: keepScroll,
            onEnter: enterLocation,
        });
        const list = listView({ ui, icons, onSort: (key) => area.sortBy(key) });
        const columns = columnView({ ui, icons, entryAt: listings.entryAt, onResize: tabs.setWidth });
        const status = folderStatus({
            ui,
            chordOf: deck.chordOf,
            onShowHidden: () => settings.set('showHidden', true),
            onReveal: deck.reveal,
            onPrivacySettings: () => disk.privacySettings().catch(() => {}),
        });
        const area = fileArea({
            ui,
            values,
            tabs,
            listings,
            list,
            columns,
            status,
            showsHidden,
            foldersFirst: () => !!settings.get('foldersFirst'),
            select,
            setFilterText: (text) => bar.setFilter(text),
            onDraw: drawToolbar,
        });
        const operator = fileOperator({
            ui,
            openURL: deck.open,
            fileURL: deck.fileURL,
            disk,
            areaElement: area.element,
            draggableRowAt: area.draggableRowAt,
            entryAt: listings.entryAt,
            labelOf: area.labelOf,
            selection: tabs.selection,
            select,
            onGo: (path) => tabs.go(path),
            onOpenInNewTab: (path) => tabs.open(path),
            onMade: showMade,
            onMoved: relocate,
            onChanged: listings.load,
            onStatus: area.showStatus,
        });
        const bar = toolbar({
            ui,
            theme,
            chordOf: deck.chordOf,
            tildify: util.tildify,
            homeLocation: () => home,
            onBack: () => tabs.back(),
            onForward: () => tabs.forward(),
            onUp: () => tabs.up(),
            onCrumb: openCrumb,
            onToggleFavorite: toggleFavorite,
            onView: setView,
            onFilter: area.filterBy,
            onFilterSubmit: area.pickFirstMatch,
            onFilterCancel: area.cancelFilter,
        });
        const favorites = favoriteList({
            ui,
            reveal: deck.reveal,
            show: deck.show,
            records,
            tildify: util.tildify,
            folds,
            currentLocation: tabs.location,
            onGo: (path) => tabs.go(path),
            onOpenInNewTab: (path) => tabs.open(path),
            onDraw: drawStar,
        });
        selectionInput({
            ui,
            areaElement: area.element,
            isColumnView: () => area.view() === 'columns',
            location: tabs.location,
            selectedPath: tabs.selectedPath,
            selection: tabs.selection,
            walkedFolder: area.walkedFolder,
            entriesIn: area.entriesIn,
            entryAt: listings.entryAt,
            listAt: area.listAt,
            isLoaded: listings.has,
            load: listings.load,
            select,
            selectIn,
            toggle,
            extend,
            selectAll,
            open: operator.open,
            openInNewTab: (path) => tabs.open(path),
            rename: operator.rename,
            quickLook: operator.quickLook,
        });
        fileMenu({
            ui,
            chordOf: deck.chordOf,
            reveal: deck.reveal,
            writeText: deck.clipboard.writeText,
            areaElement: area.element,
            entryAt: listings.entryAt,
            rowOf: area.rowOf,
            folderAt: columns.folderAt,
            selectedPath: tabs.selectedPath,
            selection: tabs.selection,
            workingFolder: area.workingFolder,
            select,
            isFavorite: favorites.has,
            onAddFavorite: favorites.add,
            onRemoveFavorite: favorites.remove,
            open: operator.open,
            openInNewTab: (path) => tabs.open(path),
            quickLook: operator.quickLook,
            rename: operator.rename,
            trash: operator.trash,
            newFolder: operator.newFolder,
            showsHidden,
            onToggleHidden: toggleHidden,
            onGoToFolder: () => goTo.show(),
        });
        const goTo = goToFolder({
            ui,
            disk,
            tildify: util.tildify,
            homeLocation: () => home,
            location: tabs.location,
            onGo: goToPath,
        });

        ui.addStyle(STYLE);
        bar.setView(area.view());
        content.append(bar.element, list.header, area.element, area.footer);
        sidebar.append(tabs.element, favorites.element);
        new ResizeObserver(() => {
            if (list.fit(content.clientWidth)) area.draw();
        }).observe(content);
        for (const part of [area, bar, tabs, favorites]) operator.acceptDrops(part.element, part.folderAt);
        settings.on((key) => {
            if (key === 'showHidden' || key === 'foldersFirst') area.draw();
        });
        disk.places()
            .then((answer) => {
                home = answer.home;
                favorites.setPlaces(answer.places);
                return tabs.restore((path) => disk.exists(path));
            })
            .catch(area.failToStart);

        deck.view({
            content,
            sidebar,
            didAppear: () => {
                showing = true;
                if (tabs.front()) {
                    watchShown();
                    load();
                }
                area.element.focus();
            },
            didDisappear: () => {
                showing = false;
                disk.closeQuickLook().catch(() => {});
                watchShown();
            },
        });
        deck.keys({
            newTab: { key: 'mod+t', label: 'New tab', run: () => tabs.open() },
            closeTab: { key: 'mod+w', label: 'Close tab', run: () => tabs.close(tabs.front()) },
            reopenTab: { key: 'mod+shift+t', label: 'Reopen closed tab', run: () => tabs.reopen() },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { key: `mod+${number}`, label: `Tab ${number}`, run: () => tabs.showAt(number - 1) },
                ])
            ),
            lastTab: { key: 'mod+9', label: 'Last tab', run: () => tabs.showAt(-1) },
            back: { key: 'mod+[', label: 'Back', run: () => tabs.back() },
            forward: { key: 'mod+]', label: 'Forward', run: () => tabs.forward() },
            enclosing: { key: 'mod+up', label: 'Enclosing folder', run: () => tabs.up() },
            open: { key: 'mod+down', label: 'Open', run: () => operator.open(selectedEntries()) },
            openWithDefaultApp: {
                key: 'alt+enter',
                label: 'Open with default app',
                run: () => operator.open(selectedEntries(), { usesDefaultApp: true }),
            },
            filter: { key: 'mod+f', label: 'Filter this folder', run: () => bar.focusFilter() },
            goToFolder: { key: 'mod+l', label: 'Go to Folder', run: () => tabs.front() && goTo.show() },
            home: { key: 'mod+shift+h', label: 'Go to Home', run: () => tabs.go(home) },
            desktop: { key: 'mod+shift+d', label: 'Go to Desktop', run: () => goToPlace('desktop') },
            downloads: { key: 'mod+alt+l', label: 'Go to Downloads', run: () => goToPlace('downloads') },
            applications: {
                key: 'mod+shift+a',
                label: 'Go to Applications',
                run: () => goToPlace('applications'),
            },
            hidden: { key: 'mod+shift+.', label: 'Show hidden files', run: toggleHidden },
            newFolder: {
                key: 'mod+shift+n',
                label: 'New folder',
                run: () => operator.newFolder(area.workingFolder()),
            },
            // Finder's Command-1 and Command-2 for views are tabs here, so Control is added.
            columnView: { key: 'ctrl+mod+1', label: 'As columns', run: () => setView('columns') },
            listView: { key: 'ctrl+mod+2', label: 'As list', run: () => setView('list') },
            trash: {
                key: 'mod+backspace',
                label: 'Move to Trash',
                run: () => operator.trash(selectedEntries()),
            },
        });
        deck.commands(() =>
            [
                ...favorites.places().map((place) => place.path),
                ...favorites.paths().filter((path) => !favorites.placeOf(path)),
            ].map((path) => ({
                label: favorites.labelOf(path),
                hint: util.tildify(path),
                icon: ui.icon(favorites.iconNameOf(path), { size: 16 }),
                keywords: ['폴더', 'folder'],
                address: path,
                run: () => {
                    deck.show();
                    tabs.go(path);
                },
            }))
        );

        // Drawn at once: until the folder is read, the area shows it loading. The favorites are drawn here, as only a
        // new location changes which of them is lit.
        function enterLocation() {
            bar.setFilter(tabs.filter().text);
            watchShown();
            favorites.draw();
            area.draw();
            return load();
        }

        // A listing kept for `folder`: what the tab in front waited on its folder's read to do is done.
        function applyListing(folder) {
            const whenRead = folder === tabs.location() ? tabs.takeWhenRead() : null;
            if (whenRead?.select) tabs.select(whenRead.select);
            listings.keepOnly(new Set([...tabs.locations(), ...area.shownFolders()]));
            area.draw();
            if (typeof whenRead?.scroll === 'number') area.element.scrollTop = whenRead.scroll;
            else if (whenRead?.scroll === 'reveal' && tabs.selectedPath()) area.reveal(tabs.selectedPath());
            watchShown({ renew: folder === tabs.location() });
        }

        // Only a loaded list's scroll is the tab's own.
        function keepScroll() {
            if (listings.has(tabs.location())) tabs.keepScroll(area.element.scrollTop);
        }

        function load() {
            const location = tabs.location();
            return location ? listings.load(location) : undefined;
        }

        function watchShown(options) {
            listings.watch(showing && tabs.location() ? area.shownFolders() : null, options);
        }

        // No scroll unless asked: a right click selects its row, and a scroll would close the menu just opened there.
        function select(path, { reveal = false } = {}) {
            if (!tabs.front()) return;
            tabs.select(path);
            showSelection(reveal && path);
        }

        // Entries of `folder`, the lead the last of them. None leaves the folder itself selected, the way into it kept,
        // unless it is the tab's.
        function selectIn(folder, paths) {
            if (!tabs.front()) return;
            if (!paths.length) return select(folder === tabs.location() ? null : folder);
            tabs.setSelection(paths, { lead: paths.at(-1), anchor: paths[0] });
            showSelection(null);
        }

        // Adds the entry to the selection, or takes it away; the lead and the anchor go to it, or to the last one left.
        // An entry of another folder is selected alone.
        function toggle(path) {
            const before = tabs.selectedPath();
            if (!tabs.front() || !before || parentOf(before) !== parentOf(path)) return select(path);
            const was = new Set(tabs.selection());
            if (was.has(path)) was.delete(path);
            else was.add(path);
            const next = area
                .entriesIn(parentOf(path))
                .map((entry) => entry.path)
                .filter((each) => was.has(each));
            if (!next.length) return select(null);
            const lead = next.includes(path) ? path : next.at(-1);
            tabs.setSelection(next, { lead, anchor: lead });
            showSelection(null);
        }

        // The entries from the anchor to `path`, as the folder lists them. An entry of another folder is selected
        // alone.
        function extend(path, { reveal = false } = {}) {
            const anchor = tabs.anchor() || tabs.selectedPath();
            if (!tabs.front() || !anchor || parentOf(anchor) !== parentOf(path)) return select(path, { reveal });
            const listed = area.entriesIn(parentOf(path)).map((entry) => entry.path);
            const [from, to] = [listed.indexOf(anchor), listed.indexOf(path)];
            if (from < 0 || to < 0) return select(path, { reveal });
            tabs.setSelection(listed.slice(Math.min(from, to), Math.max(from, to) + 1), { lead: path, anchor });
            showSelection(reveal && path);
        }

        // Everything the folder the keyboard walks shows.
        function selectAll() {
            if (!tabs.front()) return;
            const listed = area.entriesIn(area.walkedFolder()).map((entry) => entry.path);
            if (!listed.length) return;
            const lead = listed.includes(tabs.selectedPath()) ? tabs.selectedPath() : listed[0];
            tabs.setSelection(listed, { lead, anchor: listed[0] });
            showSelection(null);
        }

        function showSelection(revealed) {
            area.showSelection();
            watchShown();
            if (revealed) area.reveal(revealed);
        }

        // A folder, or a file selected in its folder.
        function goToPath(folder, file) {
            if (folder !== tabs.location()) return tabs.go(folder, { from: file });
            if (file) select(file, { reveal: true });
        }

        // A folder made where the person still looks is selected, in sight, to be named.
        async function showMade(path) {
            const folder = parentOf(path);
            if (!area.shownFolders().includes(folder)) return false;
            area.clearFilter();
            await listings.load(folder);
            select(path, { reveal: true });
            return true;
        }

        // In columns a crumb inside the tab's folder is selected, so the columns stay.
        function openCrumb(path) {
            const location = tabs.location();
            const inColumns = area.view() === 'columns';
            if (inColumns && location && isInside(path, location)) select(path);
            else if (inColumns && path === location) select(null);
            else tabs.go(path);
        }

        function setView(next) {
            if (next === area.view()) return;
            bar.setView(next);
            area.setView(next);
            watchShown();
            area.element.focus({ preventScroll: true });
        }

        function relocate(from, to) {
            const follow = (path) => util.movePath(path, from, to);
            tabs.relocate(follow, parentOf(from) || '/');
            listings.relocate(follow);
            favorites.relocate(follow);
        }

        // The path runs to the lead in columns, or else to the tab's folder. The tab is named for the folder in front.
        function drawToolbar() {
            tabs.setFolder(area.workingFolder());
            const selected = area.view() === 'columns' ? tabs.selectedPath() : null;
            const shown = selected && area.columnFolders().includes(parentOf(selected)) ? selected : tabs.location();
            bar.setPath(shown);
            bar.setNavigation({
                canGoBack: tabs.canGoBack(),
                canGoForward: tabs.canGoForward(),
                canGoUp: !!tabs.location() && tabs.location() !== '/',
            });
        }

        function toggleFavorite() {
            const location = tabs.location();
            if (!location) return false;
            if (favorites.has(location)) favorites.remove(location);
            else favorites.add(location);
            return true;
        }

        function drawStar() {
            const location = tabs.location();
            bar.setFavorite(!!location && favorites.has(location));
        }

        function goToPlace(id) {
            tabs.go(favorites.placePath(id));
        }

        function toggleHidden() {
            settings.set('showHidden', !showsHidden());
        }

        function showsHidden() {
            return !!settings.get('showHidden');
        }

        function selectedEntries() {
            return tabs.selection().map(listings.entryAt).filter(Boolean);
        }
    },
};
