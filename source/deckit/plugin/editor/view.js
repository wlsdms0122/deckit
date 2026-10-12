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
        const RECENT_FOLDERS_KEPT = 10;

        const workspaces = workspaceModel({ main });
        // A path already being opened, with the open under way.
        const opening = new Map();

        ui.addStyle(
            [
                TABS_STYLE,
                PATH_BAR_STYLE,
                NOTICE_STYLE,
                DRAFTS_STYLE,
                EMPTY_STATE_STYLE,
                MINIMAP_STYLE,
                SIDEBAR_STYLE,
                TREE_STYLE,
                WORKSPACE_SEARCH_STYLE,
                QUICK_OPEN_STYLE,
            ].join('\n')
        );
        const disk = fileDisk({ engine, main, onDiskStateChange: heardDiskState });
        const drafts = unsavedDrafts({
            ui,
            records,
            main,
            isOpen: workspaces.isOpen,
            openDrafts: () =>
                workspaces
                    .files()
                    .filter(disk.isDirty)
                    .map((file) => [file.path, disk.draftOf(file)]),
            onOpen: (path) => open(path),
            onSavedAs: async (path) => {
                await checkOpenFile(path);
                await open(path);
            },
        });
        const session = savedSession({ records, main, workspaces });
        const { extensions: look, colorHighlighter } = codeTheme({ engine, theme, ui });
        const find = findInFile({ engine, ui });
        const code = codeView({
            engine,
            theme,
            ui,
            settings,
            look,
            separatorExtension: disk.separatorExtension,
            createFindPanel: find.createPanel,
            onUpdate: heardUpdate,
        });
        const map = minimap({ engine, theme, ui, colorHighlighter });
        const tabBar = tabs({
            theme,
            ui,
            isDirty: disk.isDirty,
            onSelect: (file) => show(file),
            onKeep: keep,
            onClose: close,
            menuOf: tabMenu,
        });
        const breadcrumbs = pathBar({ ui, util, onReveal: revealInTree });
        const diskNotice = notice({
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
        const entries = entryActions({
            ui,
            host,
            main,
            disk,
            filesUnder: workspaces.filesUnder,
            isDirty: disk.isDirty,
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
            recentFolders: unopenedRecentFolders,
            onPickFolder: pickFolder,
            onPickFiles: pickFiles,
            onOpenFolder: (path) => openFolder(path),
            onSwitch: switchTo,
            onCloseWorkspace: closeWorkspace,
            onReorder: (from, to) => {
                workspaces.reorder(from, to);
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

        map.setMode(settings.get('minimap'));
        emptyEditor.element.hidden = true;
        stage.append(emptyEditor.element, map.element);
        stage.addEventListener('mousemove', (event) => map.showNear(event));
        content.append(tabBar.element, breadcrumbs.element, diskNotice.element, drafts.element, stage);
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
                        if (entry) entries.trash(workspaces.front(), entry);
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
                    recentFolders: unopenedRecentFolders,
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

        function heardUpdate(update) {
            const file = workspaces.files().find((candidate) => candidate.view === update.view);
            const inFront = !!file && file === workspaces.current();
            if (update.selectionSet && inFront) breadcrumbs.showCursor(file);
            const reparsed = () => engine.syntaxTree(update.startState) !== engine.syntaxTree(update.state);
            if (inFront && (update.docChanged || update.geometryChanged || reparsed())) map.update();
            if (!update.docChanged || !file) return;
            drafts.keepSoon();
            // Typing in a preview keeps it: it is being worked on now, not glanced at.
            if (file.preview) {
                file.preview = false;
                paint();
            }
            if (disk.isDirty(file) !== file.drawnDirty) paint();
        }

        // `drawnDirty` is what each file was drawn as, so typing redraws only when a file crosses saved and unsaved.
        function paint() {
            const front = workspaces.front();
            const files = front?.files || [];
            const current = workspaces.current();
            tabBar.set(files, { current, workspace: front });
            emptyEditor.element.hidden = files.length > 0;
            if (!files.length) emptyEditor.show(front, unopenedRecentFolders());
            for (const file of workspaces.files()) {
                file.box.style.visibility = file === current ? 'visible' : 'hidden';
                file.drawnDirty = disk.isDirty(file);
            }
            map.attach(current ? current.view : null);
            diskNotice.show(current);
            breadcrumbs.show(current, front?.root);
            sidePanel.draw();
            drafts.show();
        }

        function placeMinimap() {
            map.setMode(settings.get('minimap'));
            for (const file of workspaces.files()) file.box.style.right = map.inset();
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

        // A file that is not text goes to the system's app only when opened, not when a click in the tree previews it.
        async function open(path, { background = false, preview = false, preserveFocus = false } = {}) {
            const result = await tryOpen(path, { background, preview, preserveFocus });
            if (result.file) return result.file;
            if (result.passedBy) return null;
            if (result.error.kind === 'NOT_TEXT') {
                if (!background && !preserveFocus) host.open(host.fileURL(path), { userInitiated: true });
            } else
                ui.dialog({
                    title: `Could not open ${nameOf(path)}`,
                    message: result.error.message,
                    confirmLabel: 'OK',
                });
            return null;
        }

        // A path already being opened is waited for, not read again, so two requests at once are one tab. Its request
        // number is taken before any waiting.
        async function tryOpen(path, options = {}) {
            const request = options.background ? 0 : workspaces.request();
            while (opening.has(path)) await opening.get(path).catch(() => {});
            const underWay = openNow(path, { ...options, request });
            opening.set(path, underWay);
            try {
                return await underWay;
            } finally {
                if (opening.get(path) === underWay) opening.delete(path);
            }
        }

        // Opens end out of order, since a file not open yet is read first. One that something was requested after does
        // not come forward: a preview is passed by, and a kept file opens behind as its tab.
        async function openNow(path, { background = false, preview = false, preserveFocus = false, request = 0 } = {}) {
            const isBehind = () => !background && request !== workspaces.latestRequest();
            const opened = workspaces.fileAt(path);
            if (opened) {
                if (!preview) opened.preview = false;
                if (!background && !isBehind()) show(opened, { preserveFocus });
                else paint();
                return { file: opened };
            }
            let onDisk;
            try {
                onDisk = await main.call('read', path);
            } catch (error) {
                if (preview && isBehind()) return { passedBy: true };
                return { error };
            }
            if (preview && isBehind()) return { passedBy: true };
            const { box, view } = code.create(onDisk.text, path, { inset: map.inset() });
            stage.append(box);
            const file = disk.admit({ path, box, view, preview }, onDisk, drafts.get(path));
            if (disk.isDirty(file)) file.preview = false;
            // The workspace is chosen only now, so a folder opened during the read is the one it goes to.
            const holder = workspaces.holderOf(path);
            const stale =
                file.preview && holder ? holder.files.find((other) => other.preview && !disk.isDirty(other)) : null;
            const index = stale
                ? holder.files.indexOf(stale)
                : holder?.current
                  ? holder.files.indexOf(holder.current) + 1
                  : null;
            const workspace = workspaces.place(file, index);
            session.reopened(workspace, path);
            if (stale) {
                if (workspace.current === stale) workspace.current = file;
                workspaces.release(stale);
            }
            if (background || isBehind()) {
                workspaces.fillIdleFront(workspace, file);
                paint();
                session.save();
            } else show(file, { preserveFocus });
            return { file };
        }

        function keep(file) {
            if (!file.preview) return;
            file.preview = false;
            paint();
        }

        async function openAt(path, { line, col = 0, length = 0 }) {
            const file = await open(path, { preview: true });
            if (!file || !line) return;
            const { doc } = file.view.state;
            const target = doc.line(Math.min(Math.max(1, line), doc.lines));
            const from = Math.min(target.from + col, target.to);
            file.view.dispatch({ selection: { anchor: from, head: Math.min(from + length, target.to) } });
            file.view.dispatch({ effects: code.scrollEffect(file.view, file.view.state.selection.main) });
            file.view.focus();
        }

        async function checkOpenFile(path) {
            const file = workspaces.fileAt(path);
            if (file) await disk.check(file).catch(() => false);
        }

        async function keepMine(file) {
            if (!file) return;
            try {
                await disk.keepMine(file);
            } catch (error) {
                ui.dialog({ title: `Could not read ${nameOf(file.path)}`, message: error.message, confirmLabel: 'OK' });
            }
        }

        // What was here is in the new file then, so this one closes without asking.
        async function saveElsewhere(file) {
            let picked = [];
            try {
                picked = await main.call('pick', 'save', file.path);
            } catch {
                return;
            }
            if (!picked[0]) return;
            if (picked[0] === file.path) {
                await save(file, true);
                return;
            }
            try {
                await main.call('write', picked[0], disk.textOf(file.view.state), null);
            } catch (error) {
                ui.dialog({ title: 'Could not save', message: error.message, confirmLabel: 'OK' });
                return;
            }
            await checkOpenFile(picked[0]);
            drop(file);
            await open(picked[0]);
        }

        async function save(file, force = false) {
            if (!file || (!disk.isDirty(file) && !force)) return true;
            try {
                await disk.save(file, { force });
                return true;
            } catch (error) {
                if (error.kind === 'CHANGED')
                    ui.dialog({
                        title: `${nameOf(file.path)} changed on disk`,
                        message:
                            'Another program wrote to it after it was opened here. Saving now replaces that with what is here.',
                        confirmLabel: 'Save anyway',
                        cancelLabel: 'Cancel',
                        extraLabel: 'Reload from disk',
                        onExtra: () => reload(file, true),
                        destructive: true,
                        onConfirm: () => save(file, true),
                    });
                else
                    ui.dialog({
                        title: `Could not save ${nameOf(file.path)}`,
                        message: error.message,
                        confirmLabel: 'OK',
                    });
                return false;
            }
        }

        async function saveAll(files) {
            for (const file of files) if (disk.isDirty(file)) await save(file);
        }

        // A file gone is marked so by disk.check, and the notice then offers what is left.
        async function reload(file, force = false) {
            if (!file) return false;
            try {
                return await disk.reload(file, { force });
            } catch (error) {
                if (error.kind === 'GONE') {
                    await disk.check(file).catch(() => false);
                    return false;
                }
                ui.dialog({
                    title: `Could not reload ${nameOf(file.path)}`,
                    message: error.message,
                    confirmLabel: 'OK',
                });
                return false;
            }
        }

        function close(file) {
            if (!file) return;
            if (!disk.isDirty(file)) return drop(file);
            ui.dialog({
                title: `Save changes to ${nameOf(file.path)}?`,
                message: 'Closing without saving loses them.',
                confirmLabel: 'Save',
                cancelLabel: 'Cancel',
                extraLabel: "Don't save",
                onExtra: () => drop(file),
                onConfirm: async () => {
                    if (await save(file)) drop(file);
                },
            });
        }

        // Closes without asking. Closing is the answer to "save changes?", so whatever was not saved is let go, and it
        // counts as a request for what is left. The keyboard moves on only if it was in the file or nowhere: a file
        // trashed from the tree leaves it in the tree, for the next ⌘⌫.
        function drop(file) {
            const index = (workspaces.front()?.files || []).indexOf(file);
            const focused = document.activeElement;
            const follow = file.view.hasFocus || !focused || focused === document.body;
            const inFront = workspaces.current() === file;
            if (!workspaces.release(file)) return;
            if (inFront) workspaces.bringToFront(workspaces.front(), workspaces.front()?.current ?? null);
            drafts.forget(file.path);
            tabBar.letGo(file.path, index);
            paint();
            session.save();
            if (follow) workspaces.current()?.view.focus();
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
                ...entries.pathItems(file.path, relative),
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
            entries.createHere(workspaces.front(), workspaces.current(), type);
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
                    tabBar.rename(file.path, next);
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
                } else if (!workspace.files.length) workspaces.remove(workspace);
            }
            const recent = recentFolders();
            if (recent.some((path) => move(path) !== path))
                records.set('recent-folders', recent.map(move).filter(Boolean));
            paint();
            session.save();
        }

        function recentFolders() {
            return records.get('recent-folders', []);
        }

        function unopenedRecentFolders() {
            return recentFolders().filter((path) => !workspaces.withRoot(path));
        }

        // `fromSession` comes from the caller: a person opening a folder mid-restore asked for it.
        async function openFolder(path, { mode = 'files', fromSession = false } = {}) {
            let workspace = workspaces.withRoot(path);
            if (!workspace) {
                workspace = addWorkspace(path, { mode });
                session.forgetUnrestored(path);
                workspaces.gather(workspace);
                const loose = workspaces.loose();
                if (loose && !loose.files.length) workspaces.remove(loose);
                await workspace.tree.setRoot(path);
                workspaces.listFiles(workspace, true);
            }
            if (!fromSession) {
                const recent = [path, ...recentFolders().filter((other) => other !== path)];
                records.set('recent-folders', recent.slice(0, RECENT_FOLDERS_KEPT));
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
                onMove: (entry, folder) => entries.move(workspace, entry, folder),
                menu: entries.menuOf(workspace),
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
                workspaces.remove(workspace);
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
            let paths = [];
            try {
                paths = await main.call('pick', 'folder');
            } catch {
                return;
            }
            if (paths[0]) openFolder(paths[0]);
        }

        async function pickFiles() {
            let paths = [];
            try {
                paths = await main.call('pick', 'file');
            } catch {
                return;
            }
            for (const path of paths) await open(path);
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
