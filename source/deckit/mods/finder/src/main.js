const { columnView } = require('./view/column-view.js');
const { favoriteList } = require('./sidebar/favorite-list.js');
const { fileArea } = require('./file-area/file-area.js');
const { fileMenu } = require('./file-area/file-menu.js');
const { fileOperator } = require('./file-operation/file-operator.js');
const { folderStatus } = require('./file-area/folder-status.js');
const { goToFolder } = require('./go-to-folder/go-to-folder.js');
const { iconCache } = require('./icon/icon-cache.js');
const { listView } = require('./view/list-view.js');
const { listingCache } = require('./listing/listing-cache.js');
const { parentOf, isInside } = require('./path/path.js');
const { selectionInput } = require('./file-area/selection-input.js');
const { switcher, inFront } = require('./switcher/switcher.js');
const { tabList } = require('./sidebar/tab-list.js');
const { toolbar } = require('./toolbar/toolbar.js');

// The system places `go-to-place` goes to, by the id the disk gives each.
const PLACES = [
    ['home', 'Home'],
    ['desktop', 'Desktop'],
    ['documents', 'Documents'],
    ['downloads', 'Downloads'],
    ['applications', 'Applications'],
];

class Finder {
    static keywords = ['finder', 'files', 'file', 'folder', 'explorer', 'browse', '파인더', '파일', '폴더', '탐색기'];
    //! Lucide "folder" (ISC).
    static icon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
    static configuration = {
        showHidden: {
            type: 'boolean',
            title: 'Show hidden files',
            description: 'Names that start with a dot, such as .git or .env.',
            default: false,
        },
        foldersFirst: {
            type: 'boolean',
            title: 'Keep folders on top',
            description: 'Folders come before files whichever column the list is sorted by.',
            default: true,
        },
    };

    async attach(shell, deckit) {
        const { theme, ui } = shell;
        const { storage, configuration, util } = deckit;
        const { values, records } = storage;
        // Every folder, icon and file change goes through this module, so a Finder whose module cannot start shows
        // nothing.
        const disk = await deckit.mainProcess('main-process/disk.js');
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
            about: deckit.about,
            disk,
            isShown: (folder) => area.shownFolders().includes(folder),
            onRead: applyListing,
        });
        const tabs = tabList({
            ui,
            chordOf: deckit.chordOf,
            reveal: deckit.reveal,
            records,
            tildify: util.tildify,
            folds,
            homeLocation: () => home,
            folderInFront: (location, opened) => area.folderInFront(location, opened),
            isFavorite: (path) => favorites.has(path),
            onAddFavorite: (path) => favorites.add(path),
            onLeave: keepScroll,
            onEnter: enterLocation,
        });
        const list = listView({ ui, icons, onSort: (key) => area.sortBy(key) });
        const columns = columnView({ ui, icons, entryAt: listings.entryAt, onResize: tabs.setWidth });
        const status = folderStatus({
            ui,
            chordOf: deckit.chordOf,
            onShowHidden: () => configuration.set('showHidden', true),
            onReveal: deckit.reveal,
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
            foldersFirst: () => !!configuration.get('foldersFirst'),
            select,
            setFilterText: (text) => bar.setFilter(text),
            onDraw: drawToolbar,
        });
        const operator = fileOperator({
            ui,
            openURL: deckit.open,
            fileURL: deckit.fileURL,
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
            chordOf: deckit.chordOf,
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
            reveal: deckit.reveal,
            show: shell.show,
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
            chordOf: deckit.chordOf,
            reveal: deckit.reveal,
            writeText: deckit.clipboard.writeText,
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
            folderInFront: area.workingFolder,
            onGo: goToPath,
        });

        ui.addStyle(STYLE);
        bar.setView(area.view());
        content.append(bar.element, list.header, area.element, area.footer);
        sidebar.append(tabs.element, favorites.element);
        this.resizing = new ResizeObserver(() => {
            if (list.fit(content.clientWidth)) area.draw();
        });
        this.resizing.observe(content);
        for (const part of [area, bar, tabs, favorites]) operator.acceptDrops(part.element, part.folderAt);
        configuration.on((key) => {
            if (key === 'showHidden' || key === 'foldersFirst') area.draw();
        });
        disk.places()
            .then((answer) => {
                home = answer.home;
                favorites.setPlaces(answer.places);
                return tabs.restore((path) => disk.exists(path));
            })
            .catch(area.failToStart);

        shell.view({
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
        // Their keys stay Finder's while a field is typed in, so the field never hears them; they open nothing then.
        const open = () => !typing() && operator.open(selectedEntries());
        const openWithDefaultApp = () => !typing() && operator.open(selectedEntries(), { usesDefaultApp: true });
        const showGoTo = () => tabs.front() && goTo.show();
        const newFolder = () => operator.newFolder(area.workingFolder());
        const trash = () => operator.trash(selectedEntries());
        deckit.commands({
            'open-folder': {
                description: 'Goes to a folder in the tab in front; a file goes to its folder, selected there.',
                params: {
                    type: 'object',
                    properties: { path: { type: 'string', title: 'Folder', description: 'A path from / or ~.' } },
                    required: ['path'],
                },
                run: openFolder,
                complete: (_param, partial) => foldersAtHand(partial),
            },
            'go-to-place': {
                description: 'Goes to Home, Desktop or another of the system places.',
                params: {
                    type: 'object',
                    properties: {
                        place: {
                            type: 'string',
                            title: 'Place',
                            oneOf: PLACES.map(([id, title]) => ({ const: id, title })),
                        },
                    },
                    required: ['place'],
                },
                run: goToPlace,
            },
        });
        deckit.keys({
            newTab: { label: 'New Tab', key: 'mod+t', run: () => tabs.open() },
            closeTab: { label: 'Close Tab', key: 'mod+w', run: () => tabs.close(tabs.front()) },
            reopenTab: { label: 'Reopen Closed Tab', key: 'mod+shift+t', run: () => tabs.reopen() },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { label: `Tab ${number}`, key: `mod+${number}`, run: () => tabs.showAt(number - 1) },
                ])
            ),
            lastTab: { label: 'Last tab', key: 'mod+9', run: () => tabs.showAt(-1) },
            back: { label: 'Back', key: 'mod+[', run: () => tabs.back() },
            forward: { label: 'Forward', key: 'mod+]', run: () => tabs.forward() },
            enclosing: { label: 'Enclosing Folder', key: 'mod+up', run: () => tabs.up() },
            open: { label: 'Open', key: 'ctrl+enter', run: open },
            openWithDefaultApp: { label: 'Open with Default App', key: 'alt+enter', run: openWithDefaultApp },
            filter: { label: 'Filter This Folder', key: 'mod+f', run: () => bar.focusFilter() },
            goToFolder: { label: 'Go to Folder…', key: 'mod+l', run: showGoTo },
            home: { label: 'Go to Home', key: 'mod+shift+h', run: () => goToPlace({ place: 'home' }) },
            desktop: { label: 'Go to Desktop', key: 'mod+shift+d', run: () => goToPlace({ place: 'desktop' }) },
            downloads: { label: 'Go to Downloads', key: 'mod+alt+l', run: () => goToPlace({ place: 'downloads' }) },
            applications: {
                label: 'Go to Applications',
                key: 'mod+shift+a',
                run: () => goToPlace({ place: 'applications' }),
            },
            hidden: { label: 'Show Hidden Files', key: 'mod+shift+.', run: () => toggleHidden() },
            newFolder: { label: 'New Folder', key: 'mod+shift+n', run: newFolder },
            // Finder's Command-1 and Command-2 for views are tabs here, so Control is added.
            columnView: { label: 'As columns', key: 'ctrl+mod+1', run: () => setView('columns') },
            listView: { label: 'As list', key: 'ctrl+mod+2', run: () => setView('list') },
            trash: { label: 'Move to Trash', key: 'mod+backspace', run: trash },
        });
        deckit.extends.switcher({
            actions: switcher({
                ui,
                util,
                atHand,
                favorites,
                foldersAtHand,
                places: PLACES,
                show: shell.show,
                does: {
                    'open-folder': openFolder,
                    ...inFront({
                        'go-to-place': goToPlace,
                        'go-to-folder': showGoTo,
                        'new-tab': () => tabs.open(),
                        'close-tab': () => tabs.close(tabs.front()),
                        'reopen-tab': () => tabs.reopen(),
                        back: () => tabs.back(),
                        forward: () => tabs.forward(),
                        'enclosing-folder': () => tabs.up(),
                        open,
                        'open-with-default-app': openWithDefaultApp,
                        filter: () => bar.focusFilter(),
                        'toggle-hidden': () => toggleHidden(),
                        'new-folder': newFolder,
                        'show-as': ({ view }) => setView(view),
                        trash,
                    }),
                },
            }),
        });

        // `ready()` is told once the path is found to be there, before Finder goes to it.
        async function openFolder({ path }, { ready = () => {} } = {}) {
            const full = path.startsWith('~') && home ? home + path.slice(1) : path;
            if (!full.startsWith('/')) throw new Error(`${path} is not a path from / or ~`);
            const kind = await disk.exists(full);
            if (!kind) throw new Error(`${util.tildify(full)} is not there`);
            if (!tabs.front()) throw new Error('Finder has no tab open');
            ready();
            if (kind === 'folder') tabs.go(full);
            else goToPath(parentOf(full), full);
        }

        function goToPlace({ place }) {
            const path = place === 'home' ? home : favorites.placePath(place);
            if (!path) throw new Error(`${PLACES.find(([id]) => id === place)?.[1] ?? place} is not there`);
            tabs.go(path);
        }

        // The system places and the person's favorites, the folders kept at hand.
        function atHand() {
            return [
                ...favorites.places().map((place) => place.path),
                ...favorites.paths().filter((path) => !favorites.placeOf(path)),
            ];
        }

        // The folders at hand, ranked for `partial` by their name and their path.
        function foldersAtHand(partial) {
            const candidates = atHand().map((path) => ({
                value: path,
                title: favorites.labelOf(path),
                hint: util.tildify(path),
                keywords: [],
            }));
            if (!partial.trim()) return candidates;
            const { TIER, matchFields } = util;
            return candidates
                .map((candidate) => ({
                    candidate,
                    found: matchFields(
                        [
                            { text: candidate.title, name: true },
                            { text: candidate.hint, weight: 0.8, cap: TIER.INSIDE },
                        ],
                        partial
                    ),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }

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
            listings.keepOnly(new Set([...tabs.locations(), ...tabs.leadFolders(), ...area.shownFolders()]));
            area.draw();
            if (typeof whenRead?.scroll === 'number') area.element.scrollTop = whenRead.scroll;
            else if (whenRead?.scroll === 'reveal' && tabs.selectedPath()) area.reveal(tabs.selectedPath());
            watchShown({ renew: folder === tabs.location() });
        }

        // Only a loaded list's scroll is the tab's own.
        function keepScroll() {
            if (listings.has(tabs.location())) tabs.keepScroll(area.element.scrollTop);
        }

        // The tab's folder, read for what the tab waits on once it is (`takeWhenRead`). A read under way does: the
        // watch, asked for first, began one if the folder's listing was kept unwatched.
        function load() {
            const location = tabs.location();
            if (!location) return undefined;
            return listings.reading(location) || listings.load(location);
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
        // unless it is the tab's. `opened` is a path deeper left open, or null.
        function selectIn(folder, paths, opened) {
            if (!tabs.front()) return;
            const selected = paths.length || folder === tabs.location() ? paths : [folder];
            tabs.setSelection(selected, { lead: selected.at(-1) ?? null, anchor: selected[0] ?? null, opened });
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
            tabs.draw();
            watchShown();
            area.element.focus({ preventScroll: true });
        }

        // The listings first: a tab is named by what they say of its lead.
        function relocate(from, to) {
            const follow = (path) => util.movePath(path, from, to);
            listings.relocate(follow);
            tabs.relocate(follow, parentOf(from) || '/');
            favorites.relocate(follow);
        }

        // The path runs to the lead in columns, or else to the tab's folder.
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

        function toggleHidden() {
            configuration.set('showHidden', !showsHidden());
        }

        function showsHidden() {
            return !!configuration.get('showHidden');
        }

        function selectedEntries() {
            return tabs.selection().map(listings.entryAt).filter(Boolean);
        }

        // A field has the keys: a name being typed, or the filter.
        function typing() {
            return !!document.activeElement?.closest('input, textarea, [contenteditable]');
        }
    }

    detach() {
        this.resizing?.disconnect();
    }
}

module.exports = Finder;
