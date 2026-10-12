// "system" is the face the rest of the panel is in.
const FONTS = [
    { value: 'system', label: 'System' },
    ...[
        'Apple SD Gothic Neo',
        'Pretendard',
        'Noto Sans KR',
        'Spoqa Han Sans Neo',
        'Nanum Gothic',
        'Nanum Myeongjo',
        'Helvetica Neue',
        'Avenir Next',
        'Inter',
        'IBM Plex Sans',
        'Georgia',
        'Charter',
        'Palatino',
    ].map((name) => ({ value: name, label: name, font: `"${name}"` })),
];

Deckit.register({
    keywords: [
        'notes',
        'note',
        'memo',
        'markdown',
        'md',
        'checklist',
        'todo',
        '노트',
        '메모',
        '메모장',
        '마크다운',
        '체크리스트',
        '할일',
    ],
    // Lucide "notebook-pen" (ISC).
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NOTEBOOK_SHAPES}</svg>`,

    settings: {
        sort: {
            label: 'Sort notes by',
            type: 'choice',
            default: 'modified',
            hint: "How a folder's notes are laid out in its gallery.",
            options: [
                { value: 'modified', label: 'Date Edited' },
                { value: 'created', label: 'Date Created' },
                { value: 'name', label: 'Name' },
            ],
        },
        textSize: { label: 'Text size', type: 'number', default: 14, min: 11, max: 22, step: 1, unit: 'px' },
        font: {
            label: 'Font',
            type: 'choice',
            default: 'system',
            hint: 'The face a note is written in, its title too. Code in a note stays monospaced.',
            options: ({ ui }) => ui.installedFonts(FONTS),
        },
    },

    make({ theme, ui, storage, host, main, settings, util }) {
        const STYLE = `
            .note {
                position: relative;
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
            .note-pane { position: relative; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
            .note-pane[hidden] { display: none; }
        `;
        const { values: store } = storage;

        // Everything in the notes folder, with the relocation count it was asked at (`since`).
        let allNotes = { name: '', rel: '', folders: [], notes: [], count: 0, since: 0 };
        // A folder or a note, { kind, rel }.
        let place = store.get('at', { kind: 'folder', rel: '' });
        let hadFocus = false;
        let changeTimer = 0;

        ui.addStyle(STYLE);
        const content = ui.element('div', { className: 'note' });
        const relocations = relocationLog({ movePath: util.movePath, idle: () => noteSession.idle() });
        const editor = liveEditor({
            theme,
            ui,
            match: util.match,
            typeface: typefaceNow(),
            onChange: () => noteSession.edited(),
            onFollowLink: followLink,
            onMenu: (event, href) =>
                ui.menu({ items: noteMenus.editorItems(href), point: { x: event.clientX, y: event.clientY } }),
        });
        const noteSession = session({
            theme,
            ui,
            main,
            editor,
            movePath: util.movePath,
            onLeave: leaveNote,
            onRelocate: relocate,
            onRenamed: async () => {
                await refresh();
                paintPlace();
            },
            onMenu: (path, anchor) => ui.menu({ items: noteMenus.noteItems(path), anchor }),
        });
        const placeHistory = navigationHistory({ movePath: util.movePath, current: () => place, enter, land });
        const fileOperations = operations({
            ui,
            host,
            main,
            noteSession,
            relocations,
            onRelocate: relocate,
            onTrash: async (path, wasOpen) => {
                if (wasOpen) await leaveNote();
                else if (place.kind === 'folder' && isWithin(place.rel, path))
                    await showFolder(parentOf(path), { record: false });
            },
            refresh,
            paintPlace,
            loadTree,
            labelFor,
            openNote,
        });
        const noteMenus = menus({
            ui,
            host,
            editor,
            relocations,
            fileOperations,
            allNotes: () => allNotes,
            notePath: () => noteSession.path(),
            onOpenNote: openNote,
            onFocusTitle: () => noteSession.focusTitle(),
            onNewNote: (into) => fileOperations.newNote(into),
            labelFor,
            followLink,
        });
        const dragging = dragAndDrop({ ui, relocations, onMove: (...move) => fileOperations.move(...move) });
        // What the gallery and the sidebar both do with a note or a folder.
        const browsing = {
            noteMenu: noteMenus.noteItems,
            folderMenu: noteMenus.folderItems,
            describeDrag: dragging.describe,
            acceptDrops: dragging.acceptDrops,
            onOpenNote: (path) => openNote(path),
            onOpenFolder: (path) => showFolder(path),
            onNewNote: () => fileOperations.newNote(currentFolder()),
            onNewFolder: () => fileOperations.newFolder(currentFolder()),
        };
        const galleryNavigation = navigationBarFor();
        const noteNavigation = navigationBarFor();
        const notesGallery = gallery({
            ui,
            host,
            main,
            settings,
            relocations,
            navigation: galleryNavigation,
            shownFolder: () => (place.kind === 'folder' ? place.rel : null),
            allNotes: () => allNotes,
            ...browsing,
        });
        const sidebarTree = tree({
            ui,
            host,
            store,
            movePath: util.movePath,
            onShowAll: () => showFolder(''),
            onToggle: paintTree,
            ...browsing,
        });
        const notePane = ui.element('div', { className: 'note-pane' });

        // Nothing is drawn until the place is reached, so a note path never flashes up as a gallery.
        notesGallery.element.hidden = true;
        notePane.hidden = true;
        noteNavigation.trailing.append(noteSession.menuButton);
        notePane.append(noteNavigation.element, noteSession.element, editor.element);
        content.append(notesGallery.element, notePane);
        applyTypeface();
        main.on('changed', (paths) => {
            clearTimeout(changeTimer);
            changeTimer = setTimeout(async () => {
                await refresh();
                const open = noteSession.path();
                if (open && paths.some((path) => isWithin(open, path))) noteSession.reconcile();
            }, 100);
        });
        settings.on((key) => {
            if (key === 'sort') notesGallery.draw();
            if (key === 'textSize' || key === 'font') applyTypeface();
        });
        window.addEventListener('pagehide', () => noteSession.saveIfUnsaved());
        start();

        return {
            content,
            sidebar: sidebarTree.element,
            didAppear: () => {
                main.call('watch', true).catch(() => {});
                refresh();
                noteSession.reconcile();
                if (hadFocus && editor.isOpen() && place.kind === 'note') editor.focus();
                else if (place.kind === 'folder') notesGallery.focus();
            },
            didDisappear: () => {
                hadFocus = editor.hasFocus();
                noteSession.saveIfUnsaved();
                main.call('watch', false).catch(() => {});
            },

            keys: keyboardShortcuts({
                editor,
                onNewNote: browsing.onNewNote,
                onNewFolder: browsing.onNewFolder,
                onTrash: () => {
                    if (place.kind === 'note') fileOperations.trashNote(place.rel);
                    else if (place.rel) fileOperations.trashFolder(place.rel);
                },
                onSearch: async () => {
                    if (place.kind === 'note' && !(await showFolder(currentFolder()))) return;
                    notesGallery.focusSearch();
                },
                onBack: () => placeHistory.goBack(),
                onForward: () => placeHistory.goForward(),
            }),

            commands: () =>
                paletteCommands({
                    ui,
                    host,
                    main,
                    allNotes,
                    onNewNote: browsing.onNewNote,
                    onOpenNote: openNote,
                    onShowFolder: showFolder,
                }),
        };

        async function start() {
            await main.call('root').catch(() => {});
            await loadTree();
            const was = place;
            if (was.kind === 'note' && (await openNote(was.rel, { record: false }))) return;
            await showFolder(nearestFolder(was.kind === 'folder' ? was.rel : parentOf(was.rel)), { record: false });
        }

        // Resolves whether the folder was reached.
        async function showFolder(path, options) {
            return (await placeHistory.go({ kind: 'folder', rel: path }, options)) === 'ok';
        }

        // Resolves whether the note was reached.
        async function openNote(path, options) {
            return (await placeHistory.go({ kind: 'note', rel: path }, options)) === 'ok';
        }

        function enter(to, { focus = false, quiet = false } = {}) {
            if (to.kind === 'note') return noteSession.open(to.rel, { focus, quiet });
            if (!folderAt(allNotes, to.rel)) return 'gone';
            return noteSession.close();
        }

        function land(to) {
            const isNewFolder = to.kind === 'folder' && (place.kind !== 'folder' || place.rel !== to.rel);
            place = to;
            store.set('at', place);
            sidebarTree.reveal(to.rel);
            if (to.kind === 'folder') notesGallery.arrive({ isNewFolder });
            paintPlace();
            if (to.kind === 'folder') notesGallery.load();
        }

        async function leaveNote() {
            const path = noteSession.path() || (place.kind === 'note' ? place.rel : '');
            noteSession.closeWithoutSaving();
            await showFolder(nearestFolder(parentOf(path)), { record: false });
        }

        function currentFolder() {
            return place.kind === 'folder' ? place.rel : parentOf(place.rel);
        }

        function nearestFolder(path) {
            let folder = path;
            while (folder && !folderAt(allNotes, folder)) folder = parentOf(folder);
            return folder;
        }

        function paintPlace() {
            const steps = { canGoBack: placeHistory.canGoBack(), canGoForward: placeHistory.canGoForward() };
            const isOnNote = place.kind === 'note';
            notesGallery.element.hidden = isOnNote;
            notePane.hidden = !isOnNote;
            if (isOnNote) noteNavigation.paint(parentOf(place.rel), { isCurrent: false, ...steps });
            else {
                galleryNavigation.paint(place.rel, { isCurrent: true, ...steps });
                notesGallery.draw();
            }
            paintTree();
        }

        function paintTree() {
            sidebarTree.draw({ allNotes, place, openNote: noteSession.path() });
        }

        async function loadTree() {
            const since = relocations.count();
            try {
                allNotes = { ...(await main.call('tree')), since };
            } catch {
                return;
            }
            if (place.kind === 'folder' && !folderAt(allNotes, place.rel)) {
                // Left to run in its turn: a refresh can come from inside a move under way, which awaiting would hold.
                placeHistory.go({ kind: 'folder', rel: nearestFolder(parentOf(place.rel)) }, { record: false });
                return;
            }
            paintPlace();
        }

        function refresh() {
            return Promise.all([loadTree(), notesGallery.refresh()]);
        }

        // Run in the open note's queue right after a move, so no save is in flight to the old place. `to` null: the
        // path went to the Trash, and whoever trashed it moves the open note and the place away.
        function relocate(from, to) {
            relocations.record(from, to);
            placeHistory.relocate(from, to);
            if (to != null) {
                noteSession.relocate(from, to);
                place.rel = util.movePath(place.rel, from, to);
            }
            store.set('at', place);
            sidebarTree.relocate(from, to);
        }

        function followLink(href) {
            const target = linkTargetOf(href);
            if (target?.address) openAddress(target.address);
            else if (target?.note) openNote(linkedNotePath(noteSession.path() || '', target.note), { focus: true });
        }

        // host.open answers only whether anything opened the address, with no reason when nothing did.
        async function openAddress(address) {
            if (await host.open(address, { userInitiated: true }).catch(() => false)) return;
            ui.dialog({ title: 'Could not open the link', message: address, confirmLabel: 'OK' });
        }

        // The name label of a row or a card in sight, for a rename to type over. With neither in sight (the sidebar
        // folded away), the parent's gallery is shown.
        async function labelFor(path) {
            const isShown = (label) => !!label?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            sidebarTree.reveal(path);
            paintTree();
            const shown = [sidebarTree.labelOf(path), notesGallery.labelOf(path)].find(isShown);
            if (shown) return shown;
            if (!(await showFolder(parentOf(path)))) return null;
            await notesGallery.load();
            const label = notesGallery.labelOf(path);
            return isShown(label) ? label : null;
        }

        function navigationBarFor() {
            return navigationBar({
                ui,
                host,
                onBack: () => placeHistory.goBack(),
                onForward: () => placeHistory.goForward(),
                onGo: (path) => showFolder(path),
                acceptDrops: dragging.acceptDrops,
            });
        }

        // A face not in the list (chosen on another Mac) falls back to the theme's.
        function typefaceNow() {
            const face = FONTS.find((font) => font.value === settings.get('font'))?.font;
            return { size: settings.get('textSize'), font: face ? `${face}, ${theme.font}` : theme.font };
        }

        function applyTypeface() {
            const typeface = typefaceNow();
            editor.setTypeface(typeface);
            noteSession.setFont(typeface.font);
        }
    },
});
