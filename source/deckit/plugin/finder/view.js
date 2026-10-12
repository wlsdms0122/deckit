Deckit.register({
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

    make({ theme, ui, storage, host, main, settings, util }) {
        const { values: store, records: data } = storage;
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
        `;
        let home = '';
        let showing = false;

        const folds = {
            has: (key) => !!store.get('folds', {})[key],
            set: (key, collapsed) => store.set('folds', { ...store.get('folds', {}), [key]: collapsed }),
        };
        const content = ui.element('div', { className: 'finder-content' });
        const icons = iconCache({ ui, main, onArrive: () => area.render() });
        const listings = listingCache({
            host,
            main,
            isShown: (folder) => area.shownFolders().includes(folder),
            onRead: applyListing,
        });
        const list = listView({
            ui,
            icons,
            chordOf: host.chordOf,
            onSort: (key) => area.sortBy(key),
            onShowHidden: () => settings.set('showHidden', true),
            onReveal: host.reveal,
            onPrivacySettings: () => main.call('privacySettings').catch(() => {}),
        });
        const columns = columnView({
            ui,
            icons,
            entryAt: listings.entryAt,
            onResize: (tab, folder, width) => tabs.setWidth(tab, folder, width),
        });
        const area = fileArea({
            ui,
            store,
            settings,
            listings,
            list,
            columns,
            front: () => tabs.front(),
            select,
            setFilterText: (text) => bar.setFilter(text),
            onDraw: drawToolbar,
        });
        const bar = toolbar({
            ui,
            theme,
            chordOf: host.chordOf,
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
        const operations = fileOperations({
            ui,
            host,
            main,
            area: area.element,
            entryAt: listings.entryAt,
            labelOf: area.labelOf,
            select,
            onGo: (path) => tabs.go(path),
            onMoved: relocate,
            onChanged: listings.load,
            onStatus: area.showStatus,
        });
        const tabs = tabList({
            ui,
            host,
            data,
            tildify: util.tildify,
            folds,
            homeLocation: () => home,
            isFavorite: (path) => favorites.has(path),
            onAddFavorite: (path) => favorites.add(path),
            dropZone: operations.dropZone,
            onLeave: keepScroll,
            onEnter: enterLocation,
        });
        const favorites = sidebar({
            ui,
            host,
            data,
            tildify: util.tildify,
            folds,
            tabs: tabs.element,
            currentLocation,
            dropZone: operations.dropZone,
            onGo: (path) => tabs.go(path),
            onOpenInNewTab: (path) => tabs.open(path),
            onDraw: paintStar,
        });
        selectionInput({
            area: area.element,
            inColumns: () => area.view() === 'columns',
            currentLocation,
            selected: selectedPath,
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
            host,
            area: area.element,
            entryAt: listings.entryAt,
            selected: selectedPath,
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
            newFolder,
            showsHidden,
            onToggleHidden: toggleHidden,
        });

        ui.addStyle(STYLE);
        bar.setView(area.view());
        content.append(bar.element, list.header, area.element, area.footer);
        new ResizeObserver(() => {
            if (list.fit(content.clientWidth)) area.render();
        }).observe(content);
        operations.dropZone(bar.crumbs, (under) => {
            const crumb = under.closest('[data-crumb]');
            return crumb ? { folder: crumb.dataset.crumb, mark: crumb } : null;
        });
        operations.dropZone(area.element, area.folderUnder);
        settings.on((key) => {
            if (key === 'showHidden' || key === 'foldersFirst') area.render();
        });
        main.call('places')
            .then((answer) => {
                home = answer.home;
                favorites.setLocations(answer.places);
                return tabs.restore((path) => main.call('exists', path));
            })
            .catch(area.failToStart);

        return {
            content,
            sidebar: favorites.element,
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
                main.call('closeQuickLook').catch(() => {});
                watchShown();
            },

            keys: {
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
                newFolder: { key: 'mod+shift+n', label: 'New folder', run: () => newFolder() },
                // Finder's Command-1 and Command-2 for views are tabs here, so Control is added.
                columnView: { key: 'ctrl+mod+1', label: 'As columns', run: () => setView('columns') },
                listView: { key: 'ctrl+mod+2', label: 'As list', run: () => setView('list') },
                trash: { key: 'mod+backspace', label: 'Move to Trash', run: () => operations.trash(selectedEntry()) },
            },

            commands: () =>
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
                        host.show();
                        tabs.go(path);
                    },
                })),
        };

        // Drawn at once: until the folder is read, the list shows it loading. The favorites are painted here, as only a
        // new location changes which of them is lit.
        function enterLocation(tab) {
            bar.setFilter(tab.filter);
            watchShown();
            favorites.draw();
            area.render();
            return load();
        }

        // A listing kept for `folder`: what the tab in front waited on its folder's read to do is done.
        function applyListing(folder) {
            const tab = tabs.front();
            const whenRead = folder === tab.location ? tab.whenRead : null;
            if (whenRead) {
                tab.whenRead = null;
                if (whenRead.select) tab.selected = whenRead.select;
            }
            listings.keepOnly(new Set([...tabs.locations(), ...area.shownFolders()]));
            area.render();
            if (typeof whenRead?.scroll === 'number') area.element.scrollTop = whenRead.scroll;
            else if (whenRead?.scroll === 'reveal' && tab.selected) area.reveal(tab.selected);
            watchShown({ renew: folder === tab.location });
        }

        // Only a loaded list's scroll is the tab's own.
        function keepScroll(tab) {
            if (listings.has(tab.location)) tab.scroll = area.element.scrollTop;
        }

        function load() {
            const location = currentLocation();
            return location ? listings.load(location) : undefined;
        }

        function watchShown(options) {
            listings.watch(showing && currentLocation() ? area.shownFolders() : null, options);
        }

        // No scroll unless asked: a right click selects its row, and a scroll would close the menu just opened there.
        function select(path, { reveal = false } = {}) {
            const tab = tabs.front();
            if (!tab) return;
            tab.selected = path;
            area.showSelection();
            watchShown();
            if (reveal && path) area.reveal(path);
        }

        // In columns a crumb inside the tab's folder is picked, so the columns stay.
        function openCrumb(path) {
            const location = currentLocation();
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

        async function newFolder(into = area.workingFolder()) {
            const tab = tabs.front();
            const location = currentLocation();
            if (!tab || !into) return;
            let made;
            try {
                made = await main.call('mkdir', into);
            } catch (error) {
                area.showStatus('Could not make a folder: ' + error.message);
                return;
            }
            if (tabs.front() !== tab || tab.location !== location) return;
            area.clearFilter(tab);
            if (into === location) {
                tab.whenRead = { select: made, scroll: 'reveal' };
                await load();
            } else {
                await listings.load(into);
                select(made, { reveal: true });
            }
            const entry = listings.entryAt(made);
            if (entry) operations.rename(entry);
        }

        // The path runs to the pick in columns, or else to the tab's folder, and starts at the home folder when it is
        // inside it.
        function drawToolbar() {
            const tab = tabs.front();
            const selected = area.view() === 'columns' ? selectedPath() : null;
            const shown = selected && area.columnFolders().includes(parentOf(selected)) ? selected : currentLocation();
            const parts = [];
            for (let path = shown; path; path = parentOf(path)) {
                parts.unshift(path);
                if (path === home) break;
            }
            bar.setPath(
                parts.map((path, index) => ({
                    key: path,
                    label: displayNameOf(path),
                    title: util.tildify(path),
                    icon: 'folder',
                    current: index === parts.length - 1,
                }))
            );
            bar.setNavigation({
                canGoBack: !!tab && tab.back.length > 0,
                canGoForward: !!tab && tab.forward.length > 0,
                canGoUp: !!currentLocation() && currentLocation() !== '/',
            });
        }

        function toggleFavorite() {
            const location = currentLocation();
            if (!location) return false;
            if (favorites.has(location)) favorites.remove(location);
            else favorites.add(location);
            return true;
        }

        function paintStar() {
            const location = currentLocation();
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

        function currentLocation() {
            return tabs.front()?.location ?? null;
        }

        function selectedPath() {
            return tabs.front()?.selected ?? null;
        }

        function selectedEntry() {
            return listings.entryAt(selectedPath());
        }
    },
});
