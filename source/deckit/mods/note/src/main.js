const { movePath } = require('deckit-sdk/path');
const { dragAndDrop } = require('./browsing/drag-and-drop.js');
const { folderAt } = require('./notes-folder/folder.js');
const { notesFound } = require('./candidates/candidates.js');
const { gallery } = require('./browsing/gallery.js');
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
const { settingsOf } = require('./settings/settings.js');
const { switcher, inFront } = require('./switcher/switcher.js');
const { tree } = require('./browsing/tree.js');
const { typefaceOf } = require('./editor/typeface.js');
const { viewKeys } = require('./keys/keys.js');

// The paragraph styles, without the separators of their menu.
const STYLES = PARAGRAPH_STYLES.filter((style) => style !== '-');

class Note {
    // What detach() waits for: the open note written, its title typed and not yet applied too, so what was typed just
    // before the run ends is kept, and the notes folder no longer watched.
    end = null;

    // What attach has put on screen for the commands and reopen() to reach, while it is attached: `openWindow()` opens
    // Notes' window, or orders it front where it is open.
    screen = null;

    // The commands its manifest declares to `deckit/commands`, run from the exports for its id. Each acts on the
    // window's views, open or not, `new-note` opening it where it is closed, as the name is typed on screen; one run
    // while Notes is not attached says so.
    start(deckit) {
        const onScreen = () => {
            if (!this.screen) throw new Error('Notes has no window to open');
            return this.screen;
        };
        const commands = {
            'new-note': () => onScreen().newNote(),
            open: (args) => onScreen().openNoteOf(args),
            'show-folder': (args) => onScreen().showFolderOf(args),
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Notes has no command ${id}`);
                    await commands[id](args ?? {});
                },
            }),
        });
    }

    async attach(shell, deckit, { mainProcess }) {
        const { theme, ui } = shell;
        const { storage } = deckit;
        const settings = settingsOf();
        // An address in a note opens through `deckit/urls`; one asked while it is not connected is logged.
        let urls = null;
        const openURL = async (url) => {
            if (urls) return urls.open(url);
            console.warn(`[note] ${url} did not open: deckit/urls is not connected`);
            return false;
        };
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
        const notesFolder = await mainProcess.start('main-process/notes-folder.js');

        // Everything in the notes folder, with the relocation count it was asked at (`since`).
        let allNotes = { name: '', path: '', folders: [], notes: [], count: 0, since: 0 };
        // A folder or a note, { kind, path }.
        let place = store.get('at', { kind: 'folder', path: '' });
        let hadFocus = false;
        let changeTimer = 0;
        let searchesAsked = 0;

        ui.addStyle(STYLE);
        const content = ui.element('div', { className: 'note' });
        const relocations = relocationLog({ idle: () => noteSession.idle() });
        // The window's own keys, while it is key, made before what draws their chords.
        const keys = viewKeys(
            {
                newNote: { key: 'mod+n', run: () => newNoteHere() },
                newFolder: { key: 'mod+shift+n', run: () => newFolder() },
                // While a text field has focus, ⌘⌫ stays the field's (delete to line start).
                trash: { key: 'mod+backspace', run: () => trash(), fieldsKeep: true },
                search: { key: 'mod+f', run: () => searchInGallery() },
                back: { key: 'mod+[', run: () => goBack() },
                forward: { key: 'mod+]', run: () => goForward() },
                title: styleKey('title', 'mod+shift+t'),
                heading: styleKey('heading', 'mod+shift+h'),
                subheading: styleKey('subheading', 'mod+shift+j'),
                body: styleKey('body', 'mod+shift+b'),
                monospaced: styleKey('monospaced', 'mod+shift+m'),
                bulletedList: styleKey('bulletedList', 'mod+shift+7'),
                numberedList: styleKey('numberedList', 'mod+shift+9'),
                checklist: styleKey('checklist', 'mod+shift+l'),
                markChecked: { key: 'mod+shift+u', run: () => markChecked() },
                blockQuote: styleKey('blockQuote', "mod+'"),
            },
            { log: 'note', within: content }
        );
        this.endKeys = () => keys.listen(false);
        const editor = liveEditor({
            theme,
            ui,
            typeface: currentTypeface(),
            chordOf: (name) => keys.chordOf(name),
            clipboard: deckit.clipboard,
            onChange: () => noteSession.edited(),
            onFollowLink: followLink,
        });
        const noteSession = session({
            theme,
            ui,
            notesFolder,
            editor,
            onLeave: leaveNote,
            onRelocate: relocate,
            onRenamed: changed,
            onMenu: (path, anchor) => ui.menu({ items: noteMenus.noteItems(path), anchor }),
        });
        this.end = () => {
            clearTimeout(changeTimer);
            window.removeEventListener('pagehide', saveOnPageHide);
            return Promise.all([noteSession.settle(), notesFolder.watch(false).catch(() => {})]);
        };
        const placeHistory = navigationHistory({
            current: () => place,
            enter,
            land,
            onChange: drawPlace,
        });
        const fileOperations = operations({
            ui,
            clipboard: deckit.clipboard,
            reveal: shell.reveal,
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
            chordOf: (name) => keys.chordOf(name),
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
            chordOf: (name) => keys.chordOf(name),
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
            chordOf: (name) => keys.chordOf(name),
            store,
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
        deckit.dependencies.onConnect('deckit/configuration', (configuration) => settings.connect(configuration));
        deckit.dependencies.onConnect('deckit/urls', (connected) => {
            urls = connected;
            return () => {
                if (urls === connected) urls = null;
            };
        });
        // A face and a size left to the theme follow a new one.
        theme.onChange(applyTypeface);
        window.addEventListener('pagehide', saveOnPageHide);
        reachSavedPlace();

        // The notes beside the sidebar's tree, whose width and fold are kept as the person leaves them.
        const split = ui.splitView({
            sidebar: sidebarTree.element,
            content,
            ...store.get('sidebar', {}),
            onChange: (kept) => store.set('sidebar', kept),
        });
        const openWindow = () =>
            shell.windows.open({
                name: 'main',
                content: split.element,
                didAppear: () => {
                    editor.setRoot(content.ownerDocument);
                    notesFolder.watch(true).catch(() => {});
                    refresh();
                    noteSession.reconcile();
                    if (hadFocus && editor.isOpen() && place.kind === 'note') editor.focus();
                    else if (place.kind === 'folder') notesGallery.focus();
                },
                didBecomeKey: () => keys.listen(true),
                didResignKey: () => keys.listen(false),
                didDisappear: () => {
                    hadFocus = editor.holdsFocus();
                    noteSession.saveIfUnsaved();
                    notesFolder.watch(false).catch(() => {});
                },
            });
        openWindow();
        const newNoteHere = () => newNote(currentFolder());
        const newFolder = () => fileOperations.newFolder(currentFolder());
        const actions = switcher({
            ui,
            allNotes: () => allNotes,
            notesOf: (query, { signal }) => notesFound(query, { searchNotes, allNotes, signal }),
            styles: STYLES,
            show: openWindow,
            does: {
                open: openNoteOf,
                'show-folder': showFolderOf,
                search: searchInGallery,
                ...inFront({
                    'new-note': newNoteHere,
                    'new-folder': newFolder,
                    trash,
                    back: goBack,
                    forward: goForward,
                    'paragraph-style': ({ style }) => setParagraphStyle(style),
                    'mark-checked': markChecked,
                }),
            },
        });
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
        this.screen = {
            openWindow,
            newNote: () => {
                if (!shell.windows.list().length) openWindow();
                return fileOperations.newNote(currentFolder());
            },
            openNoteOf,
            showFolderOf,
        };

        // `ready()` is told once the note is reached.
        async function openNoteOf({ id }, { ready = () => {} } = {}) {
            if (!(await openNote(id))) throw new Error(`Could not open ${noteNameOf(id)}`);
            ready();
        }

        // `ready()` is told once the folder is reached.
        async function showFolderOf({ path }, { ready = () => {} } = {}) {
            if (!(await showFolder(path))) throw new Error(`Could not show ${path || 'All Notes'}`);
            ready();
        }

        function trash() {
            if (place.kind === 'folder' && !place.path)
                throw new Error('Open a note or a folder to move it to the Trash');
            if (place.kind === 'note') fileOperations.trashNote(place.path);
            else fileOperations.trashFolder(place.path);
        }

        // `ready()` is told once the gallery is shown.
        async function searchInGallery(args, { ready = () => {} } = {}) {
            if (place.kind === 'note' && !(await showFolder(currentFolder())))
                throw new Error('Could not show the gallery');
            ready();
            notesGallery.focusSearch();
        }

        function goBack() {
            if (!placeHistory.canGoBack()) throw new Error('There is nothing to go back to');
            placeHistory.goBack();
        }

        function goForward() {
            if (!placeHistory.canGoForward()) throw new Error('There is nothing to go forward to');
            placeHistory.goForward();
        }

        function setParagraphStyle(style) {
            if (!STYLES.some(({ key }) => key === style)) throw new Error(`There is no paragraph style ${style}`);
            whileWriting();
            editor.setParagraphStyle(style);
        }

        function markChecked() {
            whileWriting();
            editor.toggleChecked();
        }

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
            openWindow();
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
                place.path = movePath(place.path, from, to);
            }
            store.set('at', place);
            sidebarTree.relocate(from, to);
        }

        function followLink(href) {
            const target = linkTargetOf(href);
            if (target?.address) openAddress(target.address);
            else if (target?.note) openNote(linkedNotePath(noteSession.path() || '', target.note), { focus: true });
        }

        // Opening answers only whether anything opened the address, with no reason when nothing did.
        async function openAddress(address) {
            if (await openURL(address).catch(() => false)) return;
            ui.toast(`Could not open the link ${address}`, {
                kind: 'failure',
                action: { label: 'Try Again', run: () => openAddress(address) },
            });
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

        function saveOnPageHide() {
            noteSession.saveIfUnsaved();
        }

        function navigationBarFor() {
            return navigationBar({
                ui,
                chordOf: (name) => keys.chordOf(name),
                onBack: () => placeHistory.goBack(),
                onForward: () => placeHistory.goForward(),
                onGo: (path) => showFolder(path),
                acceptDrops: dragging.acceptDrops,
            });
        }

        // Only while the note holds the cursor: elsewhere a text key would change a line nobody is looking at.
        function whileWriting() {
            if (!editor.holdsFocus()) throw new Error('Put the cursor in a note first');
        }

        function styleKey(style, key) {
            return { key, run: () => setParagraphStyle(style) };
        }

        function currentTypeface() {
            return typefaceOf(
                { font: settings.get('font'), size: settings.get('textSize') },
                { faces: ui.textFonts(), theme }
            );
        }

        function applyTypeface() {
            const typeface = currentTypeface();
            editor.setTypeface(typeface);
            noteSession.setFont(typeface.font);
        }
    }

    // Its Dock item pressed while its window is closed.
    reopen() {
        this.screen?.openWindow();
    }

    detach() {
        this.screen = null;
        this.endKeys?.();
        this.endKeys = null;
        return this.end?.();
    }
}

module.exports = Note;
