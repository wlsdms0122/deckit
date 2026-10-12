Deckit.register({
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
    // Lucide "file-code" (ISC).
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

    make({ theme, ui, storage, host, main, settings, util }) {
        const { values: store, records } = storage;
        const engine = EditorEngine;

        const workspaces = workspaceModel({ main, onRelease: (file) => code.destroy(file) });
        const disk = fileDisk({ engine, main, onDiskStateChange: heardDiskState });
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
        const session = savedSession({ records, main, workspaces });
        const { extensions: themeExtensions, colorHighlighter } = codeTheme({ engine, theme, ui });
        const find = findInFile({ engine, ui });
        const code = codeView({
            engine,
            theme,
            ui,
            settings,
            themeExtensions,
            separatorExtension: disk.separatorExtension,
            createFindPanel: find.createPanel,
            onUpdate: heardUpdate,
        });
        const minimap = codeMinimap({ engine, theme, ui, colorHighlighter });
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
                color: theme.color.text,
                font: '14px ' + theme.font,
                overflow: 'hidden',
            },
        });
        const { open, tryOpen, openAt, keep } = fileOpener({
            ui,
            host,
            main,
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
                main,
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
            theme,
            ui,
            isDirty: disk.isDirty,
            onSelect: (file) => show(file),
            onKeep: keep,
            onClose: close,
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
            host,
            onQuickOpen: () => quickOpener.show(),
            onPickFolder: pickFolder,
            onPickFiles: pickFiles,
            onOpenFolder: (path) => openFolder(path),
        });
        const entryActions = treeEntryActions({
            ui,
            host,
            main,
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
            host,
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
        session.restore({ openFolder, openInBackground: (path) => tryOpen(path, { background: true }) }).then(paint);

        return {
            content,
            sidebar: sidePanel.element,
            didAppear() {
                checkDisk();
                workspaces.front()?.tree?.refresh();
                workspaces.listFiles(workspaces.front(), true);
                workspaces.current()?.view.focus();
            },
            async open(url, { activates = true } = {}) {
                const background = !activates;
                const path = host.filePath(url);
                if (!path) return false;
                const opened = !!(await tryOpen(path, { background })).file;
                if (opened && !background) host.show();
                return opened;
            },
            keys: {
                quickOpen: { key: 'mod+p', label: 'Open Quickly', run: () => quickOpener.show() },
                showFiles: { key: 'mod+1', label: 'Show the files', run: () => setMode('files') },
                showFind: { key: 'mod+3', label: 'Show find', run: () => setMode('search') },
                reveal: {
                    key: 'mod+shift+j',
                    label: 'Reveal in the files',
                    run: () => revealInFiles(workspaces.current()),
                },
                openFolder: { key: 'mod+o', label: 'Open a folder', run: () => pickFolder() },
                openFile: { key: 'mod+alt+o', label: 'Open a file', run: () => pickFiles() },
                newFile: { key: 'mod+n', label: 'New file', run: () => createHere('file') },
                newFolder: { key: 'mod+alt+n', label: 'New folder', run: () => createHere('folder') },
                // Only the row picked in the tree; elsewhere ⌘⌫ is a text field's.
                trash: {
                    key: 'mod+backspace',
                    label: 'Move to Trash',
                    run: () => {
                        const entry = workspaces.front()?.tree?.picked();
                        if (entry) entryActions.trash(workspaces.front(), entry);
                    },
                },
                previousTab: { key: 'mod+shift+[', label: 'Previous tab', run: () => stepTab(-1) },
                nextTab: { key: 'mod+shift+]', label: 'Next tab', run: () => stepTab(1) },
                save: { key: 'mod+s', label: 'Save', run: () => save(workspaces.current()) },
                saveAll: { key: 'mod+alt+s', label: 'Save all', run: () => saveAll(workspaces.files()) },
                closeFile: { key: 'mod+w', label: 'Close file', run: () => close(workspaces.current()) },
                find: { key: 'mod+f', label: 'Find in file', run: () => openFind({ replace: false }) },
                replace: { key: 'mod+alt+f', label: 'Replace in file', run: () => openFind({ replace: true }) },
                searchFolder: { key: 'mod+shift+f', label: 'Find in the workspace', run: () => setMode('search') },
                goToLine: {
                    key: 'mod+l',
                    label: 'Go to line',
                    run: () => {
                        const file = workspaces.current();
                        if (file) engine.gotoLine(file.view);
                    },
                },
                wrapLines: {
                    key: 'alt+z',
                    label: 'Wrap lines',
                    run: () => settings.set('wrap', !settings.get('wrap')),
                },
            },
            commands: () =>
                paletteCommands({
                    ui,
                    host,
                    util,
                    workspaces,
                    recentFolders: recent.unopened,
                    quickOpener,
                    onPickFolder: pickFolder,
                    onPickFiles: pickFiles,
                    onCreateFile: () => createHere('file'),
                    onSwitch: switchTo,
                    onOpenFolder: (path) => openFolder(path),
                    onOpen: (path) => open(path),
                }),
        };

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
            workspaces.bringToFront(workspaces.ownerOf(file) || workspaces.front(), file);
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

        function tabMenu(file) {
            const root = workspaces.front()?.root;
            const relative = root && isInside(file.path, root) ? relativePath(file.path, root) : '';
            const reveal = {
                label: 'Reveal in Files',
                icon: 'folders',
                hint: host.chordOf('reveal'),
                run: () => revealInFiles(file),
            };
            return [
                { label: 'Close', icon: 'x', hint: host.chordOf('closeFile'), run: () => close(file) },
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
            sidePanel.redrawNavigator();
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
                main,
                isUnsaved: (entry) =>
                    workspace.files.some(
                        (file) =>
                            (entry.folder ? isInside(file.path, entry.path) : file.path === entry.path) &&
                            disk.isDirty(file)
                    ),
                onOpen: (path, options) => open(path, options),
                onFindIn: (relative) => findIn(workspace, relative),
                onMove: (entry, folder) => entryActions.move(workspace, entry, folder),
                menu: entryActions.menuOf(workspace),
            });
            workspace.search = workspaceSearch({
                ui,
                main,
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

        async function checkDisk() {
            for (const file of workspaces.files()) await disk.check(file).catch(() => false);
        }

        async function replaceAll(results, { query, replacement, options }) {
            const done = await replaceMatches({
                results,
                query,
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
});
