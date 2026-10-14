const { dragAndDrop } = require('./drag-and-drop.js');
const { folderAt } = require('./folder.js');
const { gallery } = require('./gallery.js');
const { NOTEBOOK_SHAPES } = require('./icons.js');
const { keyboardShortcuts } = require('./keyboard-shortcuts.js');
const { linkTargetOf, linkedNotePath } = require('./link.js');
const { liveEditor } = require('./live-editor.js');
const { menus } = require('./menus.js');
const { navigationBar } = require('./navigation-bar.js');
const { navigationHistory } = require('./navigation-history.js');
const { operations } = require('./operations.js');
const { paletteCommands } = require('./palette-commands.js');
const { parentOf, isWithin } = require('./path.js');
const { relocationLog } = require('./relocation-log.js');
const { session } = require('./session.js');
const { tree } = require('./tree.js');
const { FONTS, typefaceOf } = require('./typeface.js');

// What stop() waits for: the open note written, so what was typed just before the run ends is kept, and the notes
// folder no longer watched.
let endRun = null;

module.exports = {
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
    //! Lucide "notebook-pen" (ISC).
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

    async start(deck) {
        const { theme, ui, storage, settings, util } = deck;
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
        const notesFolder = await deck.mainProcess('main-process/notes-folder.js');

        // Everything in the notes folder, with the relocation count it was asked at (`since`).
        let allNotes = { name: '', path: '', folders: [], notes: [], count: 0, since: 0 };
        // A folder or a note, { kind, path }.
        let place = store.get('at', { kind: 'folder', path: '' });
        let hadFocus = false;
        let changeTimer = 0;
        let searchesAsked = 0;

        ui.addStyle(STYLE);
        const content = ui.element('div', { className: 'note' });
        const relocations = relocationLog({ movePath: util.movePath, idle: () => noteSession.idle() });
        const editor = liveEditor({
            theme,
            ui,
            match: util.match,
            typeface: currentTypeface(),
            chordOf: deck.chordOf,
            clipboard: deck.clipboard,
            onChange: () => noteSession.edited(),
            onFollowLink: followLink,
        });
        const noteSession = session({
            theme,
            ui,
            notesFolder,
            editor,
            movePath: util.movePath,
            onLeave: leaveNote,
            onRelocate: relocate,
            onRenamed: changed,
            onMenu: (path, anchor) => ui.menu({ items: noteMenus.noteItems(path), anchor }),
        });
        endRun = () => Promise.all([noteSession.saveIfUnsaved(), notesFolder.watch(false).catch(() => {})]);
        const placeHistory = navigationHistory({
            movePath: util.movePath,
            current: () => place,
            enter,
            land,
            onChange: drawPlace,
        });
        const fileOperations = operations({
            ui,
            show: deck.show,
            clipboard: deck.clipboard,
            reveal: deck.reveal,
            notesFolder,
            relocations,
            settle: noteSession.settle,
            enqueue: noteSession.enqueue,
            openPath: noteSession.path,
            isBlank: noteSession.isBlank,
            openText: editor.text,
            onRelocate: relocate,
            onTrash: async (path, wasOpen) => {
                if (wasOpen) await leaveNote();
                else if (place.kind === 'folder' && isWithin(place.path, path))
                    await showFolder(parentOf(path), { record: false });
            },
            onNoteMade: noteMade,
            onFocusTitle: noteSession.focusTitle,
            onChanged: changed,
            labelFor,
        });
        const noteMenus = menus({
            ui,
            chordOf: deck.chordOf,
            relocations,
            fileOperations,
            allNotes: () => allNotes,
            openPath: noteSession.path,
            onOpenNote: openNote,
            onFocusTitle: noteSession.focusTitle,
            onNewNote: (into) => fileOperations.newNote(into),
            labelFor,
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
            chordOf: deck.chordOf,
            notesFolder,
            searchNotes,
            settings,
            relocations,
            navigation: galleryNavigation,
            shownFolder: () => (place.kind === 'folder' ? place.path : null),
            allNotes: () => allNotes,
            ...browsing,
        });
        const sidebarTree = tree({
            ui,
            show: deck.show,
            chordOf: deck.chordOf,
            store,
            movePath: util.movePath,
            onShowAll: () => showFolder(''),
            onToggle: drawTree,
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
        notesFolder.on('changed', (paths) => {
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
        // A face left to the theme follows a new one.
        theme.onChange(applyTypeface);
        window.addEventListener('pagehide', () => noteSession.saveIfUnsaved());
        reachSavedPlace();

        deck.view({
            content,
            sidebar: sidebarTree.element,
            didAppear: () => {
                notesFolder.watch(true).catch(() => {});
                refresh();
                noteSession.reconcile();
                if (hadFocus && editor.isOpen() && place.kind === 'note') editor.focus();
                else if (place.kind === 'folder') notesGallery.focus();
            },
            didDisappear: () => {
                hadFocus = editor.hasFocus();
                noteSession.saveIfUnsaved();
                notesFolder.watch(false).catch(() => {});
            },
        });
        deck.keys(
            keyboardShortcuts({
                editor,
                onNewNote: browsing.onNewNote,
                onNewFolder: browsing.onNewFolder,
                onTrash: () => {
                    if (place.kind === 'note') fileOperations.trashNote(place.path);
                    else if (place.path) fileOperations.trashFolder(place.path);
                },
                onSearch: async () => {
                    if (place.kind === 'note' && !(await showFolder(currentFolder()))) return;
                    notesGallery.focusSearch();
                },
                onBack: () => placeHistory.goBack(),
                onForward: () => placeHistory.goForward(),
            })
        );
        deck.commands(() =>
            paletteCommands({
                ui,
                show: deck.show,
                searchNotes,
                allNotes,
                onNewNote: browsing.onNewNote,
                onOpenNote: openNote,
                onShowFolder: showFolder,
            })
        );

        // Stopped in the main process when `signal` aborts.
        async function searchNotes(query, { signal }) {
            const id = ++searchesAsked;
            const stop = () => notesFolder.stopSearch(id).catch(() => {});
            signal.addEventListener('abort', stop);
            try {
                return await notesFolder.search(query, id);
            } finally {
                signal.removeEventListener('abort', stop);
            }
        }

        async function reachSavedPlace() {
            await notesFolder.root().catch(() => {});
            await loadTree();
            const was = place;
            if (was.kind === 'note' && (await openNote(was.path, { record: false }))) return;
            await showFolder(nearestFolder(was.kind === 'folder' ? was.path : parentOf(was.path)), { record: false });
        }

        // Resolves whether the folder was reached.
        async function showFolder(path, options) {
            return (await placeHistory.go({ kind: 'folder', path }, options)) === 'ok';
        }

        // Resolves whether the note was reached.
        async function openNote(path, options) {
            return (await placeHistory.go({ kind: 'note', path }, options)) === 'ok';
        }

        function enter(to, { focus = false, quiet = false } = {}) {
            if (to.kind === 'note') return noteSession.open(to.path, { focus, quiet });
            if (!folderAt(allNotes, to.path)) return 'gone';
            return noteSession.close();
        }

        function land(to) {
            const isNewFolder = to.kind === 'folder' && (place.kind !== 'folder' || place.path !== to.path);
            place = to;
            store.set('at', place);
            sidebarTree.reveal(to.path);
            if (to.kind === 'folder') notesGallery.arrive({ isNewFolder });
            drawPlace();
            if (to.kind === 'folder') notesGallery.load();
        }

        async function leaveNote() {
            const path = noteSession.path() || (place.kind === 'note' ? place.path : '');
            noteSession.closeWithoutSaving();
            await showFolder(nearestFolder(parentOf(path)), { record: false });
        }

        function currentFolder() {
            return place.kind === 'folder' ? place.path : parentOf(place.path);
        }

        function nearestFolder(path) {
            let folder = path;
            while (folder && !folderAt(allNotes, folder)) folder = parentOf(folder);
            return folder;
        }

        function drawPlace() {
            const steps = { canGoBack: placeHistory.canGoBack(), canGoForward: placeHistory.canGoForward() };
            const isOnNote = place.kind === 'note';
            notesGallery.element.hidden = isOnNote;
            notePane.hidden = !isOnNote;
            if (isOnNote) noteNavigation.draw(parentOf(place.path), { isFolderShown: false, ...steps });
            else {
                galleryNavigation.draw(place.path, { isFolderShown: true, ...steps });
                notesGallery.draw();
            }
            drawTree();
        }

        function drawTree() {
            sidebarTree.draw({ allNotes, place, openPath: noteSession.path() });
        }

        async function loadTree() {
            const since = relocations.since();
            try {
                allNotes = { ...(await notesFolder.tree()), since };
            } catch {
                return;
            }
            if (place.kind === 'folder' && !folderAt(allNotes, place.path)) {
                // Left to run in its turn: a refresh can come from inside a move under way, which awaiting would hold.
                placeHistory.go({ kind: 'folder', path: nearestFolder(parentOf(place.path)) }, { record: false });
                return;
            }
            drawPlace();
        }

        function refresh() {
            return Promise.all([loadTree(), notesGallery.refresh()]);
        }

        // The notes folder changed from here.
        async function changed() {
            await refresh();
            drawPlace();
        }

        // A note made here opens with its name selected, to be typed over.
        async function noteMade(path) {
            if (!(await openNote(path))) return;
            noteSession.markPristine();
            await refresh();
            noteSession.focusTitle();
        }

        // Run in the open note's queue right after a rename, a move or a trash, so no save is in flight to the old
        // place. `to` null: the path went to the Trash, and whoever trashed it moves the open note and the place away.
        function relocate(from, to) {
            relocations.record(from, to);
            placeHistory.relocate(from, to);
            if (to != null) {
                noteSession.relocate(from, to);
                place.path = util.movePath(place.path, from, to);
            }
            store.set('at', place);
            sidebarTree.relocate(from, to);
        }

        function followLink(href) {
            const target = linkTargetOf(href);
            if (target?.address) openAddress(target.address);
            else if (target?.note) openNote(linkedNotePath(noteSession.path() || '', target.note), { focus: true });
        }

        // deck.open answers only whether anything opened the address, with no reason when nothing did.
        async function openAddress(address) {
            if (await deck.open(address).catch(() => false)) return;
            ui.dialog({ title: 'Could not open the link', message: address, confirmLabel: 'OK' });
        }

        // The name label of a row or a card in sight, for a rename to type over. With neither in sight (the sidebar
        // folded away), the parent's gallery is shown.
        async function labelFor(path) {
            const isShown = (label) => !!label?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            sidebarTree.reveal(path);
            drawTree();
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
                chordOf: deck.chordOf,
                onBack: () => placeHistory.goBack(),
                onForward: () => placeHistory.goForward(),
                onGo: (path) => showFolder(path),
                acceptDrops: dragging.acceptDrops,
            });
        }

        function currentTypeface() {
            return typefaceOf({ font: settings.get('font'), size: settings.get('textSize') }, theme.font);
        }

        function applyTypeface() {
            const typeface = currentTypeface();
            editor.setTypeface(typeface);
            noteSession.setFont(typeface.font);
        }
    },

    stop() {
        return endRun?.();
    },
};
