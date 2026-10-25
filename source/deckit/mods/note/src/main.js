const { dragAndDrop } = require('./browsing/drag-and-drop.js');
const { folderAt } = require('./notes-folder/folder.js');
const { foldersFound, notesFound } = require('./candidates/candidates.js');
const { gallery } = require('./browsing/gallery.js');
const { NOTEBOOK_SHAPES } = require('./icons/icons.js');
const { linkTargetOf, linkedNotePath } = require('./editor/link.js');
const { liveEditor } = require('./editor/live-editor.js');
const { menus } = require('./browsing/menus.js');
const { navigationBar } = require('./navigation/navigation-bar.js');
const { navigationHistory } = require('./navigation/navigation-history.js');
const { operations } = require('./notes-folder/operations.js');
const { PARAGRAPH_STYLES } = require('./editor/paragraph-style.js');
const { parentOf, isWithin, noteNameOf } = require('./notes-folder/path.js');
const { relocationLog } = require('./notes-folder/relocation-log.js');
const { session } = require('./session/session.js');
const { switcher } = require('./switcher/switcher.js');
const { tree } = require('./browsing/tree.js');
const { FONTS, typefaceOf } = require('./editor/typeface.js');

// The paragraph styles, without the separators of their menu.
const STYLES = PARAGRAPH_STYLES.filter((style) => style !== '-');

// What stop() waits for: the open note written, its title typed and not yet applied too, so what was typed just before
// the run ends is kept, and the notes folder no longer watched.
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
        endRun = () => Promise.all([noteSession.settle(), notesFolder.watch(false).catch(() => {})]);
        const placeHistory = navigationHistory({
            movePath: util.movePath,
            current: () => place,
            enter,
            land,
            onChange: drawPlace,
        });
        const fileOperations = operations({
            ui,
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
            onNewNote: (into) => newNote(into),
            labelFor,
        });
        const dragging = dragAndDrop({ ui, relocations, onMove: (...move) => fileOperations.move(...move) });
        // What the gallery and the sidebar both do with a note or a folder.
        const browsing = {
            noteMenu: noteMenus.noteItems,
            folderMenu: noteMenus.folderItems,
            describeDrag: dragging.describe,
            acceptDrops: dragging.acceptDrops,
            onOpenNote: (path, options) => openNote(path, options),
            onOpenFolder: (path) => showFolder(path),
            onNewNote: () => newNote(currentFolder()),
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
            renameNote: noteMenus.renameNote,
            renameFolder: noteMenus.renameFolder,
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
        deck.commands({
            'new-note': {
                label: 'New Note',
                description: 'Makes a note in the folder in front and opens it, its name selected to type over.',
                keywords: ['새 노트', '새 메모', '노트', '메모', 'new', 'note', 'memo'],
                run: async (_args, { activates }) => {
                    if (activates) deck.show();
                    await fileOperations.newNote(currentFolder());
                },
            },
            'new-folder': {
                label: 'New Folder',
                description: 'Makes a folder in the folder in front and names it in place.',
                run: async (_args, { activates }) => {
                    if (activates) deck.show();
                    await fileOperations.newFolder(currentFolder());
                },
            },
            open: {
                label: 'Open Note',
                description: 'Opens a note.',
                keywords: ['노트 검색', '메모 검색', '노트', '메모', 'find', 'notes'],
                params: { type: 'object', properties: { id: { type: 'string', title: 'Note' } }, required: ['id'] },
                run: async ({ id }, { activates }) => {
                    if (activates) deck.show();
                    if (!(await openNote(id))) throw new Error(`Could not open ${noteNameOf(id)}`);
                },
                complete: (_param, partial, { signal }) => notesFound(partial, { searchNotes, allNotes, signal }),
            },
            'show-folder': {
                label: 'Show Folder',
                description: 'Shows the gallery of a folder.',
                keywords: ['노트', '폴더', 'note', 'folder'],
                params: {
                    type: 'object',
                    properties: { path: { type: 'string', title: 'Folder' } },
                    required: ['path'],
                },
                run: async ({ path }, { activates }) => {
                    if (activates) deck.show();
                    if (!(await showFolder(path))) throw new Error(`Could not show ${path || 'All Notes'}`);
                },
                complete: (_param, partial) => foldersFound(partial, { allNotes, util }),
            },
            trash: {
                label: 'Move to Trash',
                description: 'Moves the open note, or the folder in front, to the Trash.',
                run: (_args, { activates }) => {
                    if (place.kind === 'folder' && !place.path)
                        throw new Error('Open a note or a folder to move it to the Trash');
                    if (activates) deck.show();
                    if (place.kind === 'note') fileOperations.trashNote(place.path);
                    else fileOperations.trashFolder(place.path);
                },
            },
            search: {
                label: 'Search in Gallery',
                description:
                    "Shows the gallery of the folder in front, or the open note's, with the keyboard in its search.",
                run: async (_args, { activates }) => {
                    if (activates) deck.show();
                    if (place.kind === 'note' && !(await showFolder(currentFolder())))
                        throw new Error('Could not show the gallery');
                    notesGallery.focusSearch();
                },
            },
            back: {
                label: 'Back',
                description: 'Goes back to the note or the folder shown before.',
                run: (_args, { activates }) => {
                    if (!placeHistory.canGoBack()) throw new Error('There is nothing to go back to');
                    if (activates) deck.show();
                    placeHistory.goBack();
                },
            },
            forward: {
                label: 'Forward',
                description: 'Goes forward to the note or the folder gone back from.',
                run: (_args, { activates }) => {
                    if (!placeHistory.canGoForward()) throw new Error('There is nothing to go forward to');
                    if (activates) deck.show();
                    placeHistory.goForward();
                },
            },
            'paragraph-style': {
                label: 'Set Paragraph Style',
                description: 'Gives the lines of the selection in the open note a style.',
                params: {
                    type: 'object',
                    properties: {
                        style: {
                            type: 'string',
                            title: 'Style',
                            oneOf: STYLES.map(({ key, label }) => ({ const: key, title: label })),
                        },
                    },
                    required: ['style'],
                },
                run: ({ style }, { activates }) => {
                    if (!STYLES.some(({ key }) => key === style))
                        throw new Error(`There is no paragraph style ${style}`);
                    whileWriting(activates);
                    editor.setParagraphStyle(style);
                },
            },
            'mark-checked': {
                label: 'Mark as Checked',
                description: 'Checks the checklist items on the lines of the selection, or unchecks them when all are.',
                run: (_args, { activates }) => {
                    whileWriting(activates);
                    editor.toggleChecked();
                },
            },
        });
        deck.keys({
            newNote: { command: 'new-note', key: 'mod+n' },
            newFolder: { command: 'new-folder', key: 'mod+shift+n' },
            // While a text field has focus, ⌘⌫ stays the field's (delete to line start).
            trash: { command: 'trash', key: 'mod+backspace' },
            search: { command: 'search', key: 'mod+f' },
            back: { command: 'back', key: 'mod+[' },
            forward: { command: 'forward', key: 'mod+]' },
            title: styleKey('title', 'mod+shift+t'),
            heading: styleKey('heading', 'mod+shift+h'),
            subheading: styleKey('subheading', 'mod+shift+j'),
            body: styleKey('body', 'mod+shift+b'),
            monospaced: styleKey('monospaced', 'mod+shift+m'),
            bulletedList: styleKey('bulletedList', 'mod+shift+7'),
            numberedList: styleKey('numberedList', 'mod+shift+9'),
            checklist: styleKey('checklist', 'mod+shift+l'),
            markChecked: { command: 'mark-checked', key: 'mod+shift+u' },
            blockQuote: styleKey('blockQuote', "mod+'"),
        });
        deck.extend({ 'switcher:rows': switcher({ ui, allNotes: () => allNotes }) });

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

        // Made on screen, where its name is typed.
        function newNote(into) {
            deck.show();
            return fileOperations.newNote(into);
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

        // Only while the note holds the cursor: elsewhere a text key would change a line nobody is looking at.
        function whileWriting(activates) {
            if (!editor.holdsFocus()) throw new Error('Put the cursor in a note first');
            if (activates) deck.show();
        }

        function styleKey(style, key) {
            const { label } = STYLES.find((each) => each.key === style);
            return { command: 'paragraph-style', args: { style }, label, key };
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
