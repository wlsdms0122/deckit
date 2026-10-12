const { columnView } = require('./column-view.js');
const { favoriteList } = require('./favorite-list.js');
const { fileArea } = require('./file-area.js');
const { fileMenus } = require('./file-menus.js');
const { fileOperations } = require('./file-operations.js');
const { folderStatus } = require('./folder-status.js');
const { iconCache } = require('./icon-cache.js');
const { listView } = require('./list-view.js');
const { listingCache } = require('./listing-cache.js');
const { parentOf, isInside } = require('./path.js');
const { selectionInput } = require('./selection-input.js');
const { tabList } = require('./tab-list.js');
const { toolbar } = require('./toolbar.js');

module.exports = {
    keywords: ['finder', 'files', 'file', 'folder', 'explorer', 'browse', '파인더', '파일', '폴더', '탐색기'],
    // Lucide "folder" (ISC).
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
        const operations = fileOperations({
            ui,
            openURL: deck.open,
            fileURL: deck.fileURL,
            disk,
            areaElement: area.element,
            entryAt: listings.entryAt,
            labelOf: area.labelOf,
            select,
            onGo: (path) => tabs.go(path),
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
            areaElement: area.element,
            isColumnView: () => area.view() === 'columns',
            location: tabs.location,
            selectedPath: tabs.selectedPath,
            walkedFolder: area.walkedFolder,
            entriesIn: area.entriesIn,
            entryAt: listings.entryAt,
            isLoaded: listings.has,
            load: listings.load,
            select,
            open: operations.open,
            openInNewTab: (path) => tabs.open(path),
            quickLook: operations.quickLook,
        });
        fileMenus({
            ui,
            chordOf: deck.chordOf,
            reveal: deck.reveal,
            writeText: deck.clipboard.writeText,
            areaElement: area.element,
            entryAt: listings.entryAt,
            rowOf: area.rowOf,
            folderAt: columns.folderAt,
            selectedPath: tabs.selectedPath,
            workingFolder: area.workingFolder,
            select,
            isFavorite: favorites.has,
            onAddFavorite: favorites.add,
            onRemoveFavorite: favorites.remove,
            open: operations.open,
            openInNewTab: (path) => tabs.open(path),
            quickLook: operations.quickLook,
            rename: operations.rename,
            trash: operations.trash,
            newFolder: operations.newFolder,
            showsHidden,
            onToggleHidden: toggleHidden,
        });

        ui.addStyle(STYLE);
        bar.setView(area.view());
        content.append(bar.element, list.header, area.element, area.footer);
        sidebar.append(tabs.element, favorites.element);
        new ResizeObserver(() => {
            if (list.fit(content.clientWidth)) area.draw();
        }).observe(content);
        for (const part of [area, bar, tabs, favorites]) operations.acceptDrops(part.element, part.folderAt);
        settings.on((key) => {
            if (key === 'showHidden' || key === 'foldersFirst') area.draw();
        });
        disk.places()
            .then((answer) => {
                home = answer.home;
                favorites.setLocations(answer.places);
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
            open: { key: 'mod+down', label: 'Open', run: () => operations.open(selectedEntry()) },
            filter: { key: 'mod+f', label: 'Filter this folder', run: () => bar.focusFilter() },
            home: { key: 'mod+shift+h', label: 'Go to Home', run: () => tabs.go(home) },
            desktop: { key: 'mod+shift+d', label: 'Go to Desktop', run: () => goToLocation('desktop') },
            downloads: { key: 'mod+alt+l', label: 'Go to Downloads', run: () => goToLocation('downloads') },
            applications: {
                key: 'mod+shift+a',
                label: 'Go to Applications',
                run: () => goToLocation('applications'),
            },
            hidden: { key: 'mod+shift+.', label: 'Show hidden files', run: toggleHidden },
            newFolder: {
                key: 'mod+shift+n',
                label: 'New folder',
                run: () => operations.newFolder(area.workingFolder()),
            },
            // Finder's Command-1 and Command-2 for views are tabs here, so Control is added.
            columnView: { key: 'ctrl+mod+1', label: 'As columns', run: () => setView('columns') },
            listView: { key: 'ctrl+mod+2', label: 'As list', run: () => setView('list') },
            trash: { key: 'mod+backspace', label: 'Move to Trash', run: () => operations.trash(selectedEntry()) },
        });
        deck.commands(() =>
            [
                ...favorites.locations().map((location) => location.path),
                ...favorites.paths().filter((path) => !favorites.locationOf(path)),
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
            area.showSelection();
            watchShown();
            if (reveal && path) area.reveal(path);
        }

        // A folder made where the person still looks is picked, in sight, to be named.
        async function showMade(path) {
            const folder = parentOf(path);
            if (!area.shownFolders().includes(folder)) return false;
            area.clearFilter();
            await listings.load(folder);
            select(path, { reveal: true });
            return true;
        }

        // In columns a crumb inside the tab's folder is picked, so the columns stay.
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

        // The path runs to the pick in columns, or else to the tab's folder.
        function drawToolbar() {
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

        function goToLocation(id) {
            tabs.go(favorites.locationPath(id));
        }

        function toggleHidden() {
            settings.set('showHidden', !showsHidden());
        }

        function showsHidden() {
            return !!settings.get('showHidden');
        }

        function selectedEntry() {
            return listings.entryAt(tabs.selectedPath());
        }
    },
};
