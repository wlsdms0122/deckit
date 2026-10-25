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
            folderInFront: area.workingFolder,
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
        // Each acts on what Finder shows, so it comes to the front when a person runs it.
        deck.commands({
            'new-tab': onScreen({
                label: 'New Tab',
                description: 'Opens a tab on the folder in front.',
                run: () => tabs.open(),
            }),
            'close-tab': onScreen({
                label: 'Close Tab',
                description: 'Closes the tab in front.',
                run: () => tabs.close(tabs.front()),
            }),
            'reopen-tab': onScreen({
                label: 'Reopen Closed Tab',
                description: 'Opens the tab closed last again.',
                run: () => tabs.reopen(),
            }),
            'show-tab': onScreen({
                label: 'Show Tab',
                description: 'Shows a tab by its place in the list, -1 the last.',
                params: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] },
                run: ({ index }) => tabs.showAt(index),
            }),
            back: onScreen({ label: 'Back', description: 'Goes back to the folder before.', run: () => tabs.back() }),
            forward: onScreen({
                label: 'Forward',
                description: 'Goes forward to the folder after.',
                run: () => tabs.forward(),
            }),
            'enclosing-folder': onScreen({
                label: 'Enclosing Folder',
                description: 'Goes to the folder that holds the one in front.',
                run: () => tabs.up(),
            }),
            // Their keys stay Finder's while a field is typed in, so the field never hears them; they open nothing
            // then.
            open: onScreen({
                label: 'Open',
                description: 'Opens what is selected.',
                run: () => !typing() && operator.open(selectedEntries()),
            }),
            'open-with-default-app': onScreen({
                label: 'Open with Default App',
                description: 'Opens what is selected in the app that handles it.',
                run: () => !typing() && operator.open(selectedEntries(), { usesDefaultApp: true }),
            }),
            filter: onScreen({
                label: 'Filter This Folder',
                description: 'Narrows the folder to the names typed.',
                run: () => bar.focusFilter(),
            }),
            'go-to-folder': onScreen({
                label: 'Go to Folder…',
                description: 'Asks for a path to go to.',
                run: () => tabs.front() && goTo.show(),
            }),
            'open-folder': {
                label: 'Open Folder',
                description: 'Goes to a folder in the tab in front; a file goes to its folder, selected there.',
                keywords: ['폴더', 'folder'],
                params: {
                    type: 'object',
                    properties: { path: { type: 'string', title: 'Folder', description: 'A path from / or ~.' } },
                    required: ['path'],
                },
                run: async ({ path }, { activates }) => {
                    const full = path.startsWith('~') && home ? home + path.slice(1) : path;
                    if (!full.startsWith('/')) throw new Error(`${path} is not a path from / or ~`);
                    const kind = await disk.exists(full);
                    if (!kind) throw new Error(`${util.tildify(full)} is not there`);
                    if (!tabs.front()) throw new Error('Finder has no tab open');
                    if (activates) deck.show();
                    if (kind === 'folder') tabs.go(full);
                    else goToPath(parentOf(full), full);
                },
                complete: (_param, partial) => foldersAtHand(partial),
            },
            'go-to-place': {
                label: 'Go to Place',
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
                run: ({ place }, { activates }) => {
                    const path = place === 'home' ? home : favorites.placePath(place);
                    if (!path) throw new Error(`${PLACES.find(([id]) => id === place)?.[1] ?? place} is not there`);
                    if (activates) deck.show();
                    tabs.go(path);
                },
            },
            'toggle-hidden': onScreen({
                label: 'Show Hidden Files',
                description: 'Shows the files whose names start with a dot, or hides them again.',
                run: () => toggleHidden(),
            }),
            'new-folder': onScreen({
                label: 'New Folder',
                description: 'Makes a folder in the folder in front.',
                run: () => operator.newFolder(area.workingFolder()),
            }),
            'show-as': onScreen({
                label: 'View As',
                description: 'Shows the folder as columns or as a list.',
                params: {
                    type: 'object',
                    properties: {
                        view: {
                            type: 'string',
                            title: 'View',
                            oneOf: [
                                { const: 'columns', title: 'Columns' },
                                { const: 'list', title: 'List' },
                            ],
                        },
                    },
                    required: ['view'],
                },
                run: ({ view }) => setView(view),
            }),
            trash: onScreen({
                label: 'Move to Trash',
                description: 'Moves what is selected to the Trash.',
                run: () => operator.trash(selectedEntries()),
            }),
        });
        deck.keys({
            newTab: { command: 'new-tab', key: 'mod+t' },
            closeTab: { command: 'close-tab', key: 'mod+w' },
            reopenTab: { command: 'reopen-tab', key: 'mod+shift+t' },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { command: 'show-tab', args: { index: number - 1 }, label: `Tab ${number}`, key: `mod+${number}` },
                ])
            ),
            lastTab: { command: 'show-tab', args: { index: -1 }, label: 'Last tab', key: 'mod+9' },
            back: { command: 'back', key: 'mod+[' },
            forward: { command: 'forward', key: 'mod+]' },
            enclosing: { command: 'enclosing-folder', key: 'mod+up' },
            open: { command: 'open', key: 'ctrl+enter' },
            openWithDefaultApp: { command: 'open-with-default-app', key: 'alt+enter' },
            filter: { command: 'filter', key: 'mod+f' },
            goToFolder: { command: 'go-to-folder', key: 'mod+l' },
            home: { command: 'go-to-place', args: { place: 'home' }, label: 'Go to Home', key: 'mod+shift+h' },
            desktop: { command: 'go-to-place', args: { place: 'desktop' }, label: 'Go to Desktop', key: 'mod+shift+d' },
            downloads: {
                command: 'go-to-place',
                args: { place: 'downloads' },
                label: 'Go to Downloads',
                key: 'mod+alt+l',
            },
            applications: {
                command: 'go-to-place',
                args: { place: 'applications' },
                label: 'Go to Applications',
                key: 'mod+shift+a',
            },
            hidden: { command: 'toggle-hidden', key: 'mod+shift+.' },
            newFolder: { command: 'new-folder', key: 'mod+shift+n' },
            // Finder's Command-1 and Command-2 for views are tabs here, so Control is added.
            columnView: { command: 'show-as', args: { view: 'columns' }, label: 'As columns', key: 'ctrl+mod+1' },
            listView: { command: 'show-as', args: { view: 'list' }, label: 'As list', key: 'ctrl+mod+2' },
            trash: { command: 'trash', key: 'mod+backspace' },
        });
        deck.extend({
            'switcher:rows': {
                rows: () =>
                    atHand().map((path) => ({
                        label: favorites.labelOf(path),
                        hint: util.tildify(path),
                        icon: ui.icon(favorites.iconNameOf(path), { size: 16 }),
                        run: { command: 'open-folder', args: { path } },
                    })),
            },
        });

        // `command`, brought to the front first when a person runs it.
        function onScreen(command) {
            return {
                ...command,
                run: (args, { activates }) => {
                    if (activates) deck.show();
                    return command.run(args);
                },
            };
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

        // A field has the keys: a name being typed, or the filter.
        function typing() {
            return !!document.activeElement?.closest('input, textarea, [contenteditable]');
        }
    },
};
