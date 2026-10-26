const { codeMinimap, MINIMAP_STYLE } = require('./code/code-minimap.js');
const { codeTheme } = require('./code/code-theme.js');
const { codeView } = require('./code/code-view.js');
const { diskNotice, DISK_NOTICE_STYLE } = require('./open-file/disk-notice.js');
const { emptyState, EMPTY_STATE_STYLE } = require('./workspace/empty-state.js');
const EditorEngine = require('./engine/engine.js');
const { fileActions } = require('./open-file/file-actions.js');
const { fileDisk } = require('./open-file/file-disk.js');
const { fileOpener } = require('./open-file/file-opener.js');
const { filePathBar, PATH_BAR_STYLE } = require('./open-file/file-path-bar.js');
const { filesFound } = require('./candidates/candidates.js');
const { fileTree, TREE_STYLE } = require('./file-tree/file-tree.js');
const { findInFile } = require('./code/find-in-file.js');
const { goToLine } = require('./code/go-to-line.js');
const { nameOf, parentOf, isInside, relativePath } = require('./path/path.js');
const { quickOpen, QUICK_OPEN_STYLE } = require('./quick-open/quick-open.js');
const { recentFolders } = require('./workspace/recent-folders.js');
const { replaceMatches } = require('./workspace-search/replace.js');
const { savedSession } = require('./workspace/saved-session.js');
const { sidebar, SIDEBAR_STYLE } = require('./workspace/sidebar.js');
const { switcher, inFront } = require('./switcher/switcher.js');
const { tabs, TABS_STYLE } = require('./workspace/tabs.js');
const { treeEntryActions } = require('./file-tree/tree-entry-actions.js');
const { MONOSPACED_FONTS } = require('./code/typeface.js');
const { unsavedDrafts, DRAFTS_STYLE } = require('./open-file/unsaved-drafts.js');
const { workspaceModel } = require('./workspace/workspace-model.js');
const { workspaceSearch, WORKSPACE_SEARCH_STYLE } = require('./workspace-search/workspace-search.js');

// What stop() waits for: the unsaved text of every open file kept as a draft, typed until the run ends, and the
// folders of the open files no longer watched.
let endRun = null;

module.exports = {
    keywords: [
        'editor',
        'edit',
        'code',
        'file',
        'folder',
        'workspace',
        'text',
        '에디터',
        '편집',
        '코드',
        '파일',
        '폴더',
        '워크스페이스',
    ],
    //! Lucide "file-code" (ISC).
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/></svg>`,

    settings: {
        fontSize: { label: 'Font size', type: 'number', default: 13, min: 10, max: 24, step: 1, unit: 'px' },
        font: {
            label: 'Font',
            type: 'choice',
            default: 'system',
            hint: 'The monospaced faces installed on this Mac.',
            options: ({ ui }) => ui.installedFonts(MONOSPACED_FONTS),
        },
        wrap: {
            label: 'Wrap long lines',
            type: 'toggle',
            default: false,
            hint: "Continue a long line on the next one at the editor's edge, instead of scrolling sideways.",
        },
        minimap: {
            label: 'Minimap',
            type: 'choice',
            default: 'scroll',
            hint: "The file in miniature at the editor's right edge.",
            options: [
                { value: 'always', label: 'Always, beside the code' },
                { value: 'scroll', label: 'While scrolling, over the code' },
                { value: 'never', label: 'Never' },
            ],
        },
    },

    async start(deck) {
        const { theme, ui, storage, settings, util } = deck;
        const { values: store, records } = storage;
        const engine = EditorEngine;
        const fileSystem = await deck.mainProcess('main-process/file-system.js');

        const workspaces = workspaceModel({
            fileSystem,
            onRelease: (file) => code.destroy(file),
            onOpenFilesChange: watchOpenFolders,
        });
        const disk = fileDisk({ engine, fileSystem, onDiskStateChange: heardDiskState });
        const recent = recentFolders({ records, isOpen: (path) => !!workspaces.withRoot(path) });
        const drafts = unsavedDrafts({
            ui,
            records,
            isOpen: workspaces.isOpen,
            openDrafts: () =>
                workspaces
                    .files()
                    .filter(disk.isDirty)
                    .map((file) => [file.path, disk.draftOf(file)]),
            pick: (what, suggested) => pick(what, suggested),
            saveCopy: (path, text) => saveCopy(path, text),
            onOpen: (path) => open(path),
            onSavedAs: async (path) => {
                await checkOpenFile(path);
                await open(path);
            },
        });
        endRun = () => Promise.all([drafts.keepNow(), fileSystem.watch([])]);
        const session = savedSession({ records, fileSystem, workspaces });
        const codeLook = codeTheme({ engine, theme, ui });
        const find = findInFile({ engine, ui });
        const code = codeView({
            engine,
            theme,
            ui,
            settings,
            themeExtensions: codeLook.extensions,
            separatorExtension: disk.separatorExtension,
            createFindPanel: find.createPanel,
            onUpdate: heardUpdate,
        });
        const minimap = codeMinimap({ engine, theme, ui, colorHighlighter: codeLook.colorHighlighter });
        theme.onChange(() => {
            const next = codeTheme({ engine, theme, ui });
            code.setTheme(
                next.extensions,
                workspaces.files().map((file) => file.view)
            );
            minimap.setHighlighter(next.colorHighlighter);
        });
        // Its own stacking context: the engine lifts its panels (the find bar) to z-index 300, which would otherwise put
        // them over anything laid over the editor (the minimap).
        const stage = ui.element('div', {
            style: { flex: '1 1 auto', minHeight: '0', position: 'relative', isolation: 'isolate' },
        });
        const content = ui.element('div', {
            style: {
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--deckit-text)',
                font: '14px var(--deckit-font)',
                overflow: 'hidden',
            },
        });
        const { open, tryOpen, openAt, keep } = fileOpener({
            ui,
            deck,
            fileSystem,
            workspaces,
            disk,
            drafts,
            session,
            createView: (text, path) => {
                const made = code.create(text, path, { inset: minimap.inset() });
                stage.append(made.box);
                return made;
            },
            scrollEffect: code.scrollEffect,
            onShow: show,
            onChange: paint,
        });
        const { save, saveAll, saveElsewhere, saveCopy, pick, reload, keepMine, close, drop, checkOpenFile } =
            fileActions({
                ui,
                fileSystem,
                disk,
                workspaces,
                drafts,
                onOpen: (path) => open(path),
                onDrop: () => {
                    paint();
                    session.save();
                },
            });
        const tabBar = tabs({
            ui,
            isDirty: disk.isDirty,
            onSelect: (file) => show(file),
            onKeep: keep,
            onClose: close,
            onReorder: (file, toFile) => {
                workspaces.reorderTab(file, toFile);
                paint();
                session.save();
            },
            menuOf: tabMenu,
        });
        const pathBar = filePathBar({ ui, util, onReveal: revealInTree });
        const notice = diskNotice({
            ui,
            onSaveAs: saveElsewhere,
            onClose: close,
            onReload: (file) => reload(file, true),
            onKeepMine: keepMine,
        });
        const emptyEditor = emptyState({
            ui,
            util,
            chordOf: deck.chordOf,
            onQuickOpen: () => quickOpener.show(),
            onPickFolder: pickFolder,
            onPickFiles: pickFiles,
            onOpenFolder: (path) => openFolder(path),
        });
        const entryActions = treeEntryActions({
            ui,
            chordOf: deck.chordOf,
            reveal: deck.reveal,
            clipboard: deck.clipboard,
            fileSystem,
            disk,
            filesUnder: workspaces.filesUnder,
            relocate,
            relist: (workspace) => workspaces.listFiles(workspace, true),
            open,
            drop,
            showFiles: (workspace) => {
                switchTo(workspace);
                setMode('files');
            },
            findIn,
        });
        const sidePanel = sidebar({
            ui,
            chordOf: deck.chordOf,
            util,
            workspaces,
            isUnsaved: (workspace) => workspace.files.some(disk.isDirty),
            recentFolders: recent.unopened,
            onPickFolder: pickFolder,
            onPickFiles: pickFiles,
            onOpenFolder: (path) => openFolder(path),
            onSwitch: switchTo,
            onCloseWorkspace: closeWorkspace,
            onReorder: (workspace, toWorkspace) => {
                workspaces.reorder(workspace, toWorkspace);
                session.save();
                sidePanel.draw();
            },
            onMode: setMode,
            onShowFile: (file) => show(file),
        });
        const goTo = goToLine({ ui, scrollEffect: code.scrollEffect });
        const quickOpener = quickOpen({
            ui,
            ranker: util.ranker,
            root: () => workspaces.front()?.root || null,
            list: () => workspaces.listFiles(workspaces.front()),
            onOpen: (path) => open(path),
        });

        ui.addStyle(
            [
                TABS_STYLE,
                PATH_BAR_STYLE,
                DISK_NOTICE_STYLE,
                DRAFTS_STYLE,
                EMPTY_STATE_STYLE,
                MINIMAP_STYLE,
                SIDEBAR_STYLE,
                TREE_STYLE,
                WORKSPACE_SEARCH_STYLE,
                QUICK_OPEN_STYLE,
            ].join('\n')
        );
        minimap.setMode(settings.get('minimap'));
        emptyEditor.element.hidden = true;
        stage.append(emptyEditor.element, minimap.element);
        stage.addEventListener('mousemove', (event) => minimap.showNear(event));
        content.append(tabBar.element, pathBar.element, notice.element, drafts.element, stage);
        settings.on((key, value) => {
            for (const file of workspaces.files()) code.applySetting(file.view, key, value);
            if (key === 'minimap') placeMinimap();
        });
        fileSystem.on('changed', (folder) => {
            for (const file of workspaces.files())
                if (folderHolding(file) === folder) disk.check(file).catch(() => false);
        });
        session
            .restore({ openFolder, openInBackground: (path) => tryOpen(path, { background: true, last: true }) })
            .then(paint);

        deck.view({
            content,
            sidebar: sidePanel.element,
            didAppear() {
                checkDisk();
                workspaces.front()?.tree?.refresh();
                workspaces.listFiles(workspaces.front(), true);
                workspaces.current()?.view.focus();
            },
        });
        deck.handleURL(async (url, { activates = true } = {}) => {
            const background = !activates;
            const path = deck.filePath(url);
            if (!path) return false;
            const opened = !!(await tryOpen(path, { background })).file;
            if (opened && !background) deck.show();
            return opened;
        });
        // Each its own, so a completion of `open`, a search of the switcher and one in Open Quickly do not cancel
        // each other.
        const fileRanker = util.ranker({ paths: true });
        const actionRanker = util.ranker({ paths: true });
        const noFolder = () => (workspaces.front()?.root ? '' : 'Open a folder first');
        const noFile = () => (workspaces.current() ? '' : 'No file is open');
        const openQuickly = () => quickOpener.show();
        const newFile = when(noFolder, () => createHere('file'));
        const newFolder = when(noFolder, () => createHere('folder'));
        const trash = when(
            () => (workspaces.front()?.tree?.picked() ? '' : 'Pick a file or a folder in the files first'),
            () => entryActions.trash(workspaces.front(), workspaces.front().tree.picked())
        );
        const showFiles = when(noFolder, () => setMode('files'));
        const reveal = when(
            () => {
                const root = workspaces.front()?.root;
                if (!workspaces.current()) return 'No file is open';
                return root && isInside(workspaces.current().path, root)
                    ? ''
                    : 'The open file is not in the folder in front';
            },
            () => revealInFiles(workspaces.current())
        );
        const findInWorkspace = when(noFolder, () => setMode('search'));
        const previousTab = when(noOtherTab, () => stepTab(-1));
        const nextTab = when(noOtherTab, () => stepTab(1));
        const saveFile = when(noFile, () => save(workspaces.current()));
        const saveAllFiles = () => saveAll(workspaces.files());
        const closeFile = when(noFile, () => close(workspaces.current()));
        const findInOpenFile = when(noFile, () => openFind({ replace: false }));
        const replaceInOpenFile = when(noFile, () => openFind({ replace: true }));
        const askLine = when(noFile, () => goTo.show(workspaces.current().view));
        const wrapLines = () => settings.set('wrap', !settings.get('wrap'));
        deck.commands({
            open: {
                description:
                    'Opens a file of a workspace, the one in front unless its folder is given, without bringing it to the front.',
                params: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', title: 'File' },
                        root: { type: 'string', title: 'Workspace' },
                    },
                    required: ['path'],
                },
                run: (args) => goToFile(args, { background: true }),
                complete: (_param, partial, { args }) => {
                    const workspace = args?.root === undefined ? workspaces.front() : workspaces.withRoot(args.root);
                    return filesFound(workspace, partial, { listFiles: workspaces.listFiles, ranker: fileRanker });
                },
            },
            'open-folder': {
                description: 'Opens a folder as a workspace, or brings it to the front; with none given, asks for one.',
                params: { type: 'object', properties: { path: { type: 'string', title: 'Folder' } } },
                run: openFolderAt,
            },
        });
        deck.keys({
            quickOpen: { label: 'Open Quickly', key: 'mod+p', run: openQuickly },
            showFiles: { label: 'Show Files', key: 'mod+1', run: showFiles },
            showFind: { label: 'Find in Workspace', key: 'mod+3', run: findInWorkspace },
            reveal: { label: 'Reveal in Files', key: 'mod+shift+j', run: reveal },
            openFolder: { label: 'Open Folder…', key: 'mod+o', run: () => openFolderAt() },
            openFile: { label: 'Open File…', key: 'mod+alt+o', run: pickFiles },
            newFile: { label: 'New File', key: 'mod+n', run: newFile },
            newFolder: { label: 'New Folder', key: 'mod+alt+n', run: newFolder },
            // Only the row picked in the tree; elsewhere ⌘⌫ is a text field's.
            trash: { label: 'Move to Trash', key: 'mod+backspace', run: trash },
            previousTab: { label: 'Previous Tab', key: 'mod+shift+[', run: previousTab },
            nextTab: { label: 'Next Tab', key: 'mod+shift+]', run: nextTab },
            save: { label: 'Save', key: 'mod+s', run: saveFile },
            saveAll: { label: 'Save All', key: 'mod+alt+s', run: saveAllFiles },
            closeFile: { label: 'Close File', key: 'mod+w', run: closeFile },
            find: { label: 'Find in File', key: 'mod+f', run: findInOpenFile },
            replace: { label: 'Replace in File', key: 'mod+alt+f', run: replaceInOpenFile },
            searchFolder: { label: 'Find in Workspace', key: 'mod+shift+f', run: findInWorkspace },
            goToLine: { label: 'Go to Line', key: 'mod+l', run: askLine },
            wrapLines: { label: 'Wrap Lines', key: 'alt+z', run: wrapLines },
        });
        deck.extends.switcher({
            actions: switcher({
                ui,
                util,
                workspaces,
                recentFolders: recent.unopened,
                filesOf: (workspace, query) =>
                    filesFound(workspace, query, { listFiles: workspaces.listFiles, ranker: actionRanker }),
                show: deck.show,
                does: {
                    open: goToFile,
                    'open-folder': openFolderAt,
                    ...inFront({
                        'open-quickly': openQuickly,
                        'open-file': pickFiles,
                        'new-file': newFile,
                        'new-folder': newFolder,
                        trash,
                        'show-files': showFiles,
                        'reveal-in-files': reveal,
                        'find-in-workspace': findInWorkspace,
                        'previous-tab': previousTab,
                        'next-tab': nextTab,
                        save: saveFile,
                        'save-all': saveAllFiles,
                        'close-file': closeFile,
                        'find-in-file': findInOpenFile,
                        'replace-in-file': replaceInOpenFile,
                        'go-to-line': askLine,
                        'wrap-lines': wrapLines,
                    }),
                },
            }),
        });

        function heardDiskState(file) {
            if (disk.isDirty(file)) drafts.keepSoon();
            else drafts.forget(file.path);
            paint();
        }

        // Typing in a preview keeps it: it is being worked on now, not glanced at.
        function heardUpdate(update) {
            const file = workspaces.files().find((candidate) => candidate.view === update.view);
            const inFront = !!file && file === workspaces.current();
            if (update.selectionSet && inFront) pathBar.showCursor(file);
            const reparsed = () => engine.syntaxTree(update.startState) !== engine.syntaxTree(update.state);
            if (inFront && (update.docChanged || update.geometryChanged || reparsed())) minimap.update();
            if (!update.docChanged || !file) return;
            drafts.keepSoon();
            keep(file);
            if (disk.isDirty(file) !== file.drawnUnsaved) paint();
        }

        function paint() {
            const front = workspaces.front();
            const files = front?.files || [];
            const current = workspaces.current();
            tabBar.set(files, { current, workspace: front });
            emptyEditor.element.hidden = files.length > 0;
            if (!files.length) emptyEditor.show(front, recent.unopened());
            for (const file of workspaces.files()) {
                file.box.style.visibility = file === current ? 'visible' : 'hidden';
                file.drawnUnsaved = disk.isDirty(file);
            }
            minimap.attach(current ? current.view : null);
            notice.show(current);
            pathBar.show(current, front?.root);
            sidePanel.draw();
            drafts.show();
        }

        function placeMinimap() {
            minimap.setMode(settings.get('minimap'));
            for (const file of workspaces.files()) file.box.style.right = minimap.inset();
        }

        // A file only previewed from the tree, with `preserveFocus`, leaves the keyboard there, for the next row or ⌘⌫.
        function show(file, { preserveFocus = false } = {}) {
            if (!file) return;
            workspaces.bringToFront(workspaces.workspaceOf(file) || workspaces.front(), file);
            paint();
            session.save();
            workspaces.front().tree?.reveal(file.path);
            if (!preserveFocus) requestAnimationFrame(() => file.view.focus());
        }

        function stepTab(by) {
            const files = workspaces.front()?.files || [];
            const index = files.indexOf(workspaces.current());
            if (files.length > 1) show(files[(index + by + files.length) % files.length]);
        }

        function noOtherTab() {
            return (workspaces.front()?.files.length || 0) > 1 ? '' : 'There is no other tab';
        }

        // `run` where `unable()`, why it cannot act now, answers '', and else that reason thrown.
        function when(unable, run) {
            return () => {
                const reason = unable();
                if (reason) throw new Error(reason);
                return run();
            };
        }

        // A file of the workspace `root` names, or of the one in front, brought to the front with its workspace, or
        // with `background` opened in a tab that does not come to the front. `ready()` is told once it can be done.
        async function goToFile({ path, root }, { background = false, ready = () => {} } = {}) {
            const workspace = root === undefined ? null : workspaces.withRoot(root);
            if (root !== undefined && !workspace) throw new Error(`No workspace is open at ${root}`);
            if (!path.startsWith('/')) throw new Error(`${path} is not the path of a file`);
            ready();
            if (!background) switchTo(workspace);
            await open(path, { background });
        }

        // The folder at `path` as a workspace, brought to the front if it is one; with no path, one asked for.
        // `ready()` is told once it can be done.
        async function openFolderAt({ path } = {}, { ready = () => {} } = {}) {
            if (path !== undefined && !path.startsWith('/')) throw new Error(`${path} is not the path of a folder`);
            ready();
            if (path === undefined) pickFolder();
            else if (workspaces.withRoot(path)) switchTo(workspaces.withRoot(path));
            else await openFolder(path);
        }

        function tabMenu(file) {
            const root = workspaces.front()?.root;
            const relative = root && isInside(file.path, root) ? relativePath(file.path, root) : '';
            const reveal = {
                label: 'Reveal in Files',
                icon: 'folders',
                hint: deck.chordOf('reveal'),
                run: () => revealInFiles(file),
            };
            return [
                { label: 'Close', icon: 'x', hint: deck.chordOf('closeFile'), run: () => close(file) },
                '-',
                ...(relative ? [reveal] : []),
                ...entryActions.pathItems(file.path, relative),
            ];
        }

        function revealInTree(path) {
            setMode('files');
            workspaces.front().tree.reveal(path);
        }

        async function revealInFiles(file) {
            const front = workspaces.front();
            if (!file || !front?.root || !isInside(file.path, front.root)) return;
            setMode('files');
            await front.tree.reveal(file.path);
            front.tree.focus();
        }

        function openFind({ replace }) {
            const file = workspaces.current();
            if (file) find.open(file.view, { replace });
        }

        function createHere(type) {
            entryActions.createHere(workspaces.front(), workspaces.current(), type);
        }

        function findIn(workspace, relative) {
            setMode('search');
            workspace.search.within(relative);
        }

        // In search, the selection of the open file, when it is on one line, is what is found.
        function setMode(mode) {
            const front = workspaces.front();
            if (!front?.root) return;
            front.mode = mode;
            session.save();
            sidePanel.drawNavigator();
            if (mode !== 'search') return;
            const file = workspaces.current();
            const { from, to } = file ? file.view.state.selection.main : { from: 0, to: 0 };
            const selected = file ? file.view.state.sliceDoc(from, to) : '';
            front.search.focus(selected && !selected.includes('\n') ? selected : '');
        }

        // `to` null is the Trash; drafts then stay, since unsaved text outlives its file.
        function relocate(from, to) {
            const move = (path) => util.movePath(path, from, to);
            if (to != null) {
                for (const file of workspaces.filesUnder(from)) {
                    const next = move(file.path);
                    workspaces.move(file, next);
                    code.setLanguage(file.view, next);
                }
                drafts.follow(move);
            }
            session.follow(move);
            for (const workspace of [...workspaces.all()]) {
                workspace.search?.follow(move);
                workspace.tree?.follow(move);
                if (!workspace.root || move(workspace.root) === workspace.root) continue;
                const root = move(workspace.root);
                if (root) {
                    workspace.root = root;
                    workspaces.listFiles(workspace, true);
                } else if (!workspace.files.length) removeWorkspace(workspace);
            }
            recent.follow(move);
            paint();
            session.save();
        }

        // `fromSession` comes from the caller: a person opening a folder mid-restore asked for it.
        async function openFolder(path, { mode = 'files', fromSession = false } = {}) {
            let workspace = workspaces.withRoot(path);
            if (!workspace) {
                workspace = addWorkspace(path, { mode });
                session.forgetUnrestored(path);
                workspaces.gather(workspace);
                const loose = workspaces.loose();
                if (loose && !loose.files.length) removeWorkspace(loose);
                await workspace.tree.setRoot(path);
                workspaces.listFiles(workspace, true);
            }
            if (!fromSession) {
                recent.add(path);
                workspaces.bringToFront(workspace);
                paint();
                session.save();
            }
            return workspace;
        }

        function addWorkspace(root, { mode }) {
            const workspace = workspaces.add(root, { mode });
            workspace.tree = fileTree({
                ui,
                store,
                fileSystem,
                isUnsaved: (entry) =>
                    workspace.files.some(
                        (file) =>
                            (entry.folder ? isInside(file.path, entry.path) : file.path === entry.path) &&
                            disk.isDirty(file)
                    ),
                onOpen: (path, options) => open(path, options),
                onFindIn: (relative) => findIn(workspace, relative),
                onMove: (entry, folder) => entryActions.move(workspace, entry, folder),
                onRename: (entry) => entryActions.rename(workspace, entry),
                menu: entryActions.menuOf(workspace),
            });
            workspace.search = workspaceSearch({
                ui,
                fileSystem,
                root: () => workspace.root,
                folders: async () => workspaces.foldersOf(await workspaces.listFiles(workspace)),
                ranker: util.ranker,
                onOpen: (path, match) => openAt(path, match),
                onReplaceAll: replaceAll,
            });
            return workspace;
        }

        // A workspace's search ranks folders in a worker, which lives until the search is closed.
        function removeWorkspace(workspace) {
            workspaces.remove(workspace);
            workspace.search?.close();
        }

        function switchTo(workspace) {
            if (!workspace || workspace === workspaces.front()) return;
            workspaces.bringToFront(workspace);
            paint();
            session.save();
            workspace.tree?.refresh();
            workspaces.listFiles(workspace, true);
            workspaces.current()?.view.focus();
        }

        // Closing is a request for what is left.
        function closeWorkspace(workspace) {
            const finish = () => {
                const inFront = workspaces.front() === workspace;
                for (const file of [...workspace.files]) {
                    workspaces.release(file);
                    drafts.forget(file.path);
                }
                removeWorkspace(workspace);
                if (inFront) workspaces.bringToFront(workspaces.front(), workspaces.current() ?? null);
                session.forgetUnrestored(workspace.root);
                paint();
                session.save();
            };
            const unsaved = workspace.files.filter(disk.isDirty);
            if (!unsaved.length) return finish();
            ui.dialog({
                title: `Close ${workspace.root ? nameOf(workspace.root) : 'Files'}?`,
                message: `${unsaved.length} file${unsaved.length === 1 ? ' has' : 's have'} unsaved changes: ${unsaved.map((file) => nameOf(file.path)).join(', ')}.`,
                confirmLabel: 'Save and close',
                cancelLabel: 'Cancel',
                extraLabel: 'Close without saving',
                onExtra: finish,
                onConfirm: async () => {
                    await saveAll(unsaved);
                    if (!workspace.files.some(disk.isDirty)) finish();
                },
            });
        }

        async function pickFolder() {
            const [path] = await pick('folder');
            if (path) openFolder(path);
        }

        async function pickFiles() {
            for (const path of await pick('file')) await open(path);
        }

        function watchOpenFolders() {
            fileSystem.watch([...new Set(workspaces.files().map(folderHolding))]);
        }

        function folderHolding(file) {
            return parentOf(file.path) || '/';
        }

        async function checkDisk() {
            for (const file of workspaces.files()) await disk.check(file).catch(() => false);
        }

        async function replaceAll(results, { pattern, replacement, options }) {
            const done = await replaceMatches({
                results,
                pattern,
                replacement,
                options,
                fileAt: workspaces.fileAt,
                isDirty: disk.isDirty,
                save,
                writeUnopened: disk.writeUnopened,
            });
            paint();
            return done;
        }
    },

    stop() {
        return endRun?.();
    },
};
