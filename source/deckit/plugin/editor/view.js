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
            options: ({ ui }) => ui.installedFonts(EDITOR_FONTS),
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
        const { values: store, records: data } = storage;
        const engine = EditorEngine;
        const { look: LOOK, ink } = editorLook(engine, theme, ui);
        const RECENT_KEEP = 10;

        const nameOf = (p) => p.split('/').pop() || p;
        const tilde = (p) => p.replace(/^\/Users\/[^/]+/, '~');

        const spaces = [];
        let space = null;
        // A path is open once or not at all; a workspace only lists which of these are its tabs.
        const openFiles = new Map();
        const dirty = (f) => !!f && !f.view.state.doc.eq(f.saved);
        const allFiles = () => [...openFiles.values()];
        const spaceDirty = (w) => w.files.some(dirty);
        const files = () => space?.files || [];
        const current = () => space?.current || null;

        const recentFolders = () => data.get('recent-folders', []).filter((p) => typeof p === 'string');
        // Not written while restoring: a reload mid-restore would come back to only part of the session.
        let restoring = true;
        /* Saved workspaces that failed to come back for a reason other than their folder being gone are
       carried into every later write: a reload that went wrong never shortens the session. */
        let carried = [];
        // The same for tabs of a restored workspace whose file could not be read just then.
        const carriedFiles = new Map(); // root, or "" for "Files" -> Set of paths
        const settle = (root) => {
            carried = carried.filter((c) => (c.root || '') !== (root || ''));
            carriedFiles.delete(root || '');
        };
        const tabsOf = (w) => [
            ...w.files.map((f) => f.path),
            ...[...(carriedFiles.get(w.root || '') || [])].filter((p) => !openFiles.has(p)),
        ];
        const persist = () =>
            restoring ||
            data.set('session', {
                spaces: [
                    ...spaces.map((w) => ({
                        root: w.root,
                        open: tabsOf(w),
                        active: w.current?.path || null,
                        mode: w.mode,
                    })),
                    ...carried.filter((c) => !spaces.some((w) => (w.root || '') === (c.root || ''))),
                ],
                active: space ? space.root || '' : null,
            });

        // The panel reloads on every install and plugin change, so unsaved changes are kept as drafts.
        const drafts = () => data.get('drafts', {}) || {};
        let draftTimer = null;
        const keepDrafts = () => {
            clearTimeout(draftTimer);
            draftTimer = setTimeout(() => {
                const next = {};
                for (const f of allFiles()) if (dirty(f)) next[f.path] = disk.draftOf(f);
                // Drafts of files not open now are kept: they were not dealt with, only not reopened.
                for (const [p, d] of Object.entries(drafts())) if (!openFiles.has(p)) next[p] = d;
                data.set('drafts', next);
            }, 600);
        };
        const forgetDraft = (path) => {
            const all = drafts();
            if (!(path in all)) return;
            delete all[path];
            data.set('drafts', all);
        };
        const disk = fileDisk({
            engine,
            main,
            onStandingChange: (f) => {
                if (dirty(f)) keepDrafts();
                else forgetDraft(f.path);
                paint();
            },
        });

        const content = el('div', {
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: theme.color.text,
            font: '14px ' + theme.font,
            overflow: 'hidden',
        });
        const strip = el('div', {
            display: 'flex',
            alignItems: 'stretch',
            flex: '0 0 auto',
            height: '34px',
            padding: '8px 10px 0',
            overflowX: 'auto',
            overflowY: 'hidden',
            gap: '2px',
        });
        const jump = el('div', {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flex: '0 0 auto',
            height: '28px',
            padding: '0 12px',
            borderTop: theme.border,
            borderBottom: theme.border,
            background: 'rgba(128,128,128,.06)',
            font: '12px ' + theme.font,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
        });
        const crumbs = el('div', {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flex: '1 1 auto',
            minWidth: '0',
            overflow: 'hidden',
        });
        const cursorAt = el('div', { flex: '0 0 auto', opacity: '.5', fontVariantNumeric: 'tabular-nums' });
        // The setting is the one source: ⌥Z sets it too, and settings.on applies it to every file.
        let wrap = !!settings.get('wrap');
        const wrapping = new engine.Compartment();
        const setWrap = (on) => settings.set('wrap', !!on);
        const typeNow = () => editorType(engine, { size: settings.get('fontSize'), font: settings.get('font') });
        const typeface = new engine.Compartment();
        settings.on((key, value) => {
            for (const f of allFiles()) {
                if (key === 'wrap')
                    f.view.dispatch({ effects: wrapping.reconfigure(value ? engine.EditorView.lineWrapping : []) });
                else if (key === 'fontSize' || key === 'font')
                    f.view.dispatch({ effects: typeface.reconfigure(typeNow()) });
                clipGutter(f.view);
            }
            if (key === 'wrap') wrap = !!value;
            if (key === 'minimap') placeMap();
        });
        jump.append(crumbs, cursorAt);
        const notice = el('div', {
            display: 'none',
            alignItems: 'center',
            gap: '10px',
            margin: '8px 14px 0',
            padding: '7px 8px 7px 10px',
            borderRadius: '7px',
            border: theme.border,
            font: '12.5px ' + theme.font,
            background: ui.alpha(theme.color.warn, 0.1),
        });
        const noticeText = el('div', { flex: '1 1 auto' });
        const noticeActions = el('div', { display: 'flex', gap: '6px', flex: '0 0 auto' });
        notice.append(noticeText, noticeActions);
        const keepMine = async (f) => {
            if (!f) return;
            try {
                await disk.keepMine(f);
            } catch (e) {
                ui.dialog({
                    title: `Could not read ${nameOf(f.path)}`,
                    message: failureOf(e).message,
                    confirmLabel: 'OK',
                });
            }
        };
        const wroteOver = async (path) => {
            const g = openFiles.get(path);
            if (g) await disk.check(g).catch(() => false);
        };
        const saveElsewhere = async (f) => {
            let to = [];
            try {
                to = await main.call('pick', 'save', f.path);
            } catch {
                return;
            }
            if (!to[0]) return;
            if (to[0] === f.path) {
                await save(f, true);
                return;
            }
            try {
                await main.call('write', to[0], disk.toDisk(f.view.state), null);
            } catch (e) {
                ui.dialog({ title: 'Could not save', message: failureOf(e).message, confirmLabel: 'OK' });
                return;
            }
            await wroteOver(to[0]);
            // What was here is in the new file now, so this one closes without asking.
            drop(f);
            await open(to[0]);
        };
        const paintNotice = (f) => {
            const conflict = f?.conflict,
                trouble = f?.trouble;
            notice.style.display = conflict || trouble ? 'flex' : 'none';
            noticeActions.textContent = '';
            if (!f || !(conflict || trouble)) return;
            if (trouble?.kind === 'GONE') {
                noticeText.textContent = `${nameOf(f.path)} was deleted on disk. What is here is all there is of it.`;
                noticeActions.append(
                    ui.textBtn('Save As\u2026', '', () => saveElsewhere(f), { size: 'sm' }),
                    ui.textBtn('Close', '', () => close(f), { size: 'sm' })
                );
            } else if (trouble) {
                noticeText.textContent = `${nameOf(f.path)} can no longer be opened here: ${trouble.message}`;
                noticeActions.append(ui.textBtn('Close', '', () => close(f), { size: 'sm' }));
            } else {
                noticeText.textContent = `${nameOf(f.path)} changed on disk while it had unsaved changes here.`;
                noticeActions.append(
                    ui.textBtn('Reload from disk', '', () => reload(f, true), { size: 'sm' }),
                    ui.textBtn('Keep mine', '', () => keepMine(f), { size: 'sm' })
                );
            }
        };
        /* Its own stacking context: the engine lifts its panels (the find bar) to z-index 300, which
       would otherwise put them over anything laid over the editor (the minimap). */
        const stage = el('div', { flex: '1 1 auto', minHeight: '0', position: 'relative', isolation: 'isolate' });
        const map = minimap({ engine, theme, ui, ink });
        map.setMode(settings.get('minimap'));
        stage.addEventListener('mousemove', (e) => map.near(e));
        const placeMap = () => {
            map.setMode(settings.get('minimap'));
            for (const f of allFiles()) f.box.style.right = map.inset();
        };
        const empty = el('div', { position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column' });
        stage.append(empty, map.element);
        content.append(strip, jump, notice, stage);

        const strays = el('div', {
            display: 'none',
            flexDirection: 'column',
            gap: '4px',
            margin: '8px 14px 0',
            padding: '7px 8px 7px 10px',
            borderRadius: '7px',
            border: theme.border,
            font: '12.5px ' + theme.font,
            background: ui.alpha(theme.color.warn, 0.1),
        });
        /* Redrawn with paint, so a file opened since leaves the list at once: its draft is then the
       open file's, which a Discard here must not reach. */
        const showStrays = () => {
            const left = Object.entries(drafts()).filter(
                ([p, d]) => d && typeof d.text === 'string' && !openFiles.has(p)
            );
            strays.textContent = '';
            strays.style.display = left.length ? 'flex' : 'none';
            if (!left.length) return;
            strays.appendChild(
                el(
                    'div',
                    { opacity: '.8' },
                    `Unsaved changes to ${left.length === 1 ? 'a file that is' : left.length + ' files that are'} not open:`
                )
            );
            for (const [p, d] of left) {
                const row = el('div', { display: 'flex', alignItems: 'center', gap: '8px' });
                const name = el(
                    'div',
                    {
                        flex: '1 1 auto',
                        minWidth: '0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: '600',
                    },
                    nameOf(p)
                );
                name.title = p;
                row.append(
                    name,
                    ui.textBtn(
                        'Open',
                        '',
                        async () => {
                            if (await open(p)) showStrays();
                        },
                        { size: 'sm' }
                    ),
                    ui.textBtn(
                        'Save As…',
                        '',
                        async () => {
                            let to = [];
                            try {
                                to = await main.call('pick', 'save', p);
                            } catch {
                                return;
                            }
                            if (!to[0]) return;
                            try {
                                await main.call('write', to[0], d.text, null);
                            } catch (e) {
                                ui.dialog({
                                    title: 'Could not save',
                                    message: failureOf(e).message,
                                    confirmLabel: 'OK',
                                });
                                return;
                            }
                            forgetDraft(p);
                            await wroteOver(to[0]);
                            await open(to[0]);
                            showStrays();
                        },
                        { size: 'sm' }
                    ),
                    ui.textBtn(
                        'Discard',
                        '',
                        () =>
                            ui.dialog({
                                title: `Discard the changes to ${nameOf(p)}?`,
                                message: 'They were never saved, so they are gone once discarded.',
                                confirmLabel: 'Discard',
                                cancelLabel: 'Cancel',
                                destructive: true,
                                onConfirm: () => {
                                    forgetDraft(p);
                                    showStrays();
                                },
                            }),
                        { size: 'sm' }
                    )
                );
                strays.appendChild(row);
            }
        };
        content.insertBefore(strays, stage);

        const renderEmpty = () => {
            empty.textContent = '';
            const root = space?.root;
            const buttons = [];
            const button = (label, action, run) =>
                ui.tip(ui.textBtn(label, label, run, { size: 'sm' }), label, () => host.chordOf(action));
            if (root) buttons.push(button('Open Quickly…', 'quickOpen', () => quick.show()));
            buttons.push(
                button('Open Folder…', 'openFolder', () => pickFolder()),
                button('Open File…', 'openFile', () => pickFiles())
            );
            const state = ui.emptyState({
                icon: ui.icon('fileText', 44),
                title: root ? nameOf(root) : space ? 'Files' : 'Editor',
                hint: root
                    ? 'Pick a file in the navigator, or open one by name with Open Quickly'
                    : 'Open a folder to work in it as a workspace',
                actions: buttons,
            });
            empty.appendChild(state);
            const recent = recentFolders()
                .filter((p) => !spaces.some((w) => w.root === p))
                .slice(0, 6);
            if (!root && recent.length) {
                const list = el('div', {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                    marginTop: '14px',
                    width: 'min(420px, 80%)',
                    textAlign: 'left',
                });
                list.appendChild(
                    el(
                        'div',
                        {
                            opacity: '.45',
                            font: '600 11px ' + theme.font,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            padding: '0 8px 4px',
                        },
                        'Recent folders'
                    )
                );
                for (const p of recent) {
                    const r = ui.row({ dense: true });
                    const glyph = el('span', { display: 'flex' });
                    glyph.innerHTML = ui.folderIcon(false, 14);
                    r.append(
                        glyph,
                        el('span', { fontWeight: '600' }, nameOf(p)),
                        el(
                            'span',
                            {
                                flex: '1 1 auto',
                                minWidth: '0',
                                opacity: '.45',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontSize: '12px',
                            },
                            tilde(p)
                        )
                    );
                    ui.hoverable(r);
                    r.addEventListener('click', () => openFolder(p));
                    list.appendChild(r);
                }
                state.appendChild(list);
            }
        };

        /* The strip is redrawn whole, so new tabs are told by comparing with the last drawing. A
       workspace switch swaps the whole row and is not animated. */
        const TAB_MOVE = `max-width ${theme.motion.base}ms ${theme.motion.easing}, opacity ${theme.motion.base}ms ${theme.motion.easing}, padding ${theme.motion.base}ms ${theme.motion.easing}`;
        let drawnTabs = new Set();
        let drawnFor = null;
        // A closed file's tab element stays a moment in its place while it shrinks; the file is already released.
        const leaving = new Map(); // element -> the index it had among the tabs
        const entering = new Map(); // path -> the tab element growing in, until it has
        const tab = (f) => {
            const on = f === current();
            const fresh = !drawnTabs.has(f.path);
            const t = el('div', {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 4px 0 10px',
                maxWidth: '220px',
                cursor: 'pointer',
                borderRadius: '7px 7px 0 0',
                font: '12.5px ' + theme.font,
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
                background: on ? 'rgba(128,128,128,.16)' : 'transparent',
                opacity: on ? '1' : '.65',
                overflow: 'hidden',
                transition: `background-color ${theme.motion.fast}ms ${theme.motion.easing}`,
            });
            t.dataset.path = f.path;
            // Opening redraws the strip more than once, so a growing tab carries on from the width it reached.
            const growing = entering.get(f.path);
            if (fresh || growing) {
                const from = growing ? Math.round(growing.getBoundingClientRect().width) : 0;
                const rest = { maxWidth: '220px', opacity: on ? '1' : '.65', padding: '0 4px 0 10px' };
                Object.assign(t.style, {
                    maxWidth: from + 'px',
                    opacity: growing ? growing.style.opacity : '0',
                    padding: growing ? growing.style.padding : '0',
                });
                entering.set(f.path, t);
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                        if (entering.get(f.path) !== t) return; // redrawn again since; the newer one carries on
                        t.style.transition = `background-color ${theme.motion.fast}ms ${theme.motion.easing}, ${TAB_MOVE}`;
                        Object.assign(t.style, rest);
                        setTimeout(() => {
                            if (entering.get(f.path) === t) entering.delete(f.path);
                        }, theme.motion.base);
                    })
                );
            }
            t.title = f.path;
            const glyph = el('span', { display: 'flex' });
            glyph.innerHTML = fileIcons.file(nameOf(f.path), 13);
            const label = el(
                'span',
                { overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: f.preview ? 'italic' : 'normal' },
                nameOf(f.path)
            );
            const end = el('span', {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
            });
            const shut = () => {
                end.innerHTML = ui.icon('x', 12);
                end.style.opacity = '.75';
            };
            const rest = () => {
                if (dirty(f)) {
                    end.innerHTML = '';
                    end.appendChild(
                        el('span', { width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' })
                    );
                    end.style.opacity = '.8';
                } else {
                    end.innerHTML = ui.icon('x', 12);
                    end.style.opacity = on ? '.5' : '0';
                }
            };
            t.addEventListener('mouseenter', () => {
                shut();
                if (!on) t.style.background = 'rgba(128,128,128,.08)';
            });
            t.addEventListener('mouseleave', () => {
                rest();
                if (!on) t.style.background = 'transparent';
            });
            end.addEventListener('click', (e) => {
                e.stopPropagation();
                close(f);
            });
            t.addEventListener('click', () => show(f));
            t.addEventListener('dblclick', () => keep(f));
            t.addEventListener('auxclick', (e) => {
                if (e.button === 1) close(f);
            });
            rest();
            t.append(glyph, label, end);
            return t;
        };

        const paint = () => {
            const list = files();
            const f = current();
            if (space !== drawnFor) {
                drawnTabs = new Set(list.map((x) => x.path));
                drawnFor = space;
                leaving.clear();
            }
            // Leaving tabs stay in the document: a moved node restarts its transition and the shrink would snap.
            for (const child of [...strip.children]) if (!leaving.has(child)) child.remove();
            const order = list.map((x) => ({ file: x }));
            for (const [node, at] of [...leaving].sort((a, b) => a[1] - b[1]))
                order.splice(Math.min(at, order.length), 0, { node });
            let before = null;
            for (const item of order) {
                if (item.node) {
                    before = item.node;
                    continue;
                }
                const t = tab(item.file);
                strip.insertBefore(t, before ? before.nextSibling : strip.firstChild);
                before = t;
            }
            drawnTabs = new Set(list.map((x) => x.path));
            strip.style.display = list.length || leaving.size ? 'flex' : 'none';
            empty.style.display = list.length ? 'none' : 'flex';
            if (!list.length) renderEmpty();
            // What each file was drawn as, so typing redraws only when a file crosses saved and unsaved.
            for (const x of allFiles()) {
                x.box.style.visibility = x === f ? 'visible' : 'hidden';
                x.paintedDirty = dirty(x);
            }
            map.attach(f ? f.view : null);
            paintNotice(f);
            renderJump();
            renderSide();
            showStrays();
        };

        const renderJump = () => {
            const f = current();
            crumbs.textContent = '';
            jump.style.display = f ? 'flex' : 'none';
            if (!f) return;
            const root = space.root;
            const inRoot = root && f.path.startsWith(root + '/');
            const parts = inRoot ? [nameOf(root), ...f.path.slice(root.length + 1).split('/')] : [tilde(f.path)];
            parts.forEach((part, i) => {
                if (i) crumbs.appendChild(el('span', { opacity: '.35', flex: '0 0 auto' }, '›'));
                const last = i === parts.length - 1;
                const seg = el('span', {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flex: last ? '0 1 auto' : '0 0 auto',
                    minWidth: '0',
                    opacity: last ? '1' : '.6',
                });
                const glyph = el('span', { display: 'flex' });
                glyph.innerHTML = last ? fileIcons.file(part, 12) : ui.folderIcon(false, 12);
                seg.append(glyph, el('span', { overflow: 'hidden', textOverflow: 'ellipsis' }, part));
                if (!last && inRoot) {
                    seg.style.cursor = 'pointer';
                    seg.addEventListener('click', () => {
                        setMode('files');
                        space.tree.reveal(f.path);
                    });
                }
                crumbs.appendChild(seg);
            });
            paintCursor();
        };
        const paintCursor = () => {
            const f = current();
            if (!f) return;
            const st = f.view.state;
            const head = st.selection.main.head;
            const line = st.doc.lineAt(head);
            const picked = st.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0);
            cursorAt.textContent = `${picked ? picked + ' selected  ·  ' : ''}Line ${line.number}, Col ${head - line.from + 1}  ·  ${fileIcons.language(nameOf(f.path))}`;
        };

        const panels = new WeakMap(); // view -> its find bar, for ⌥⌘F to open the replace row
        const filePanel = (view) => {
            const dom = el('div', { padding: '6px 10px' });
            const apply = (s) =>
                view.dispatch({
                    effects: engine.setSearchQuery.of(
                        new engine.SearchQuery({
                            search: s.query,
                            caseSensitive: s.caseSensitive,
                            wholeWord: s.word,
                            regexp: s.regex,
                            replace: bar.replacement,
                        })
                    ),
                });
            // The replacement is read when it is used, so the query carries it only then.
            const withReplacement = () => apply(bar.state);
            const bar = ui.searchBar({
                placeholder: 'Find in file',
                nav: true,
                replace: {
                    onReplace: () => {
                        withReplacement();
                        engine.replaceNext(view);
                    },
                    onReplaceAll: () => {
                        withReplacement();
                        engine.replaceAll(view);
                    },
                },
                onChange: apply,
                onNext: () => engine.findNext(view),
                onPrev: () => engine.findPrevious(view),
                onEscape: () => {
                    engine.closeSearchPanel(view);
                    view.focus();
                },
            });
            dom.appendChild(bar);
            /* Counted once typing pauses, not in the key that changed it: the key must reach the screen
         first. Which match is a binary search over those found, so stepping is answered at once. */
            let found = null; // for the query and text they were found in
            let counting = null;
            const countSoon = () => {
                clearTimeout(counting);
                counting = setTimeout(count, 90);
            };
            const count = () => {
                counting = null;
                const q = engine.getSearchQuery(view.state);
                if (!q.search || !q.valid) {
                    found = null;
                    return bar.setCount(0, 0);
                }
                const from = [],
                    to = [];
                const cursor = q.getCursor(view.state);
                for (let r = cursor.next(); !r.done && from.length < 10000; r = cursor.next()) {
                    from.push(r.value.from);
                    to.push(r.value.to);
                }
                found = { from, to };
                place();
            };
            const place = () => {
                if (!found) return;
                const sel = view.state.selection.main;
                let low = 0,
                    high = found.from.length - 1,
                    at = 0;
                while (low <= high) {
                    const mid = (low + high) >> 1;
                    if (found.from[mid] < sel.from) low = mid + 1;
                    else if (found.from[mid] > sel.from) high = mid - 1;
                    else {
                        if (found.to[mid] === sel.to) at = mid + 1;
                        break;
                    }
                }
                bar.setCount(at, found.from.length);
            };
            panels.set(view, bar);
            return {
                dom,
                top: true,
                mount() {
                    const q = engine.getSearchQuery(view.state);
                    bar.setQuery(q.search, { caseSensitive: q.caseSensitive, word: q.wholeWord, regex: q.regexp });
                    bar.focus();
                    count();
                },
                update(u) {
                    if (u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(engine.setSearchQuery))))
                        countSoon();
                    else if (u.selectionSet && !counting) place();
                },
                destroy() {
                    clearTimeout(counting);
                },
            };
        };

        /* Lines scrolled sideways are clipped where the gutter begins, so the gutter can stay
       transparent. The selection and cursor layers start at the gutter's left edge, so theirs are
       clipped a gutter's width further in. */
        const clipGutter = (view) => {
            const left = view.scrollDOM.scrollLeft;
            const gutter = view.dom.querySelector('.cm-gutters')?.offsetWidth || 0;
            view.contentDOM.style.clipPath = left ? `inset(0 0 0 ${left}px)` : '';
            /* The layers are zero-size boxes with their marks outside, so an inset clips them whole; a
         polygon reaching far past the box clips only what is left of the gutter's edge. */
            const edge = left + gutter;
            const far = 1e6;
            for (const layer of view.dom.querySelectorAll('.cm-layer')) {
                layer.style.clipPath = left
                    ? `polygon(${edge}px -${far}px, ${far}px -${far}px, ${far}px ${far}px, ${edge}px ${far}px)`
                    : '';
            }
        };

        // The engine's own marker is a text glyph a few pixels wide at any font size.
        const foldMarker = (open) => {
            const marker = el('span', {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '5px',
            });
            marker.className = open ? 'sk-fold-open' : 'sk-fold-closed';
            marker.title = open ? 'Fold' : 'Unfold';
            marker.innerHTML = ui.icon(open ? 'chevronDown' : 'chevronRight', 13);
            return marker;
        };
        // The "…" character sets its dots almost touching, which reads as a smudge at code sizes.
        const foldPlaceholder = (view, onclick) => {
            const chip = el('span', {
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'middle',
                height: '16px',
            });
            chip.className = 'cm-foldPlaceholder';
            chip.title = 'Unfold';
            chip.innerHTML = ui.icon('ellipsis', 16);
            chip.onclick = onclick;
            return chip;
        };
        /* The engine's special characters, less "\r" (kept by CRLF lines in a mixed file, see
       separatorFor in view/disk.js) and the byte order mark. */
        const QUIET_SPECIAL =
            /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u2028\u2029\u202d\u202e\u2066\u2067\u2069\ufff9-\ufffc]/g;
        // A compartment, so a file renamed to another kind is coloured as that kind.
        const languageSlot = new engine.Compartment();
        const languageFor = (path) => {
            const language = engine.languages[kindOf(path)?.language];
            return language ? language() : [];
        };
        const stateFor = (text, path) =>
            engine.EditorState.create({
                doc: text,
                extensions: [
                    engine.lineNumbers(),
                    engine.highlightActiveLineGutter(),
                    engine.highlightSpecialChars({ specialChars: QUIET_SPECIAL }),
                    engine.history(),
                    engine.codeFolding({ placeholderDOM: foldPlaceholder }),
                    engine.foldGutter({ markerDOM: foldMarker }),
                    engine.drawSelection(),
                    engine.dropCursor(),
                    engine.EditorState.allowMultipleSelections.of(true),
                    engine.indentOnInput(),
                    engine.bracketMatching(),
                    engine.closeBrackets(),
                    engine.rectangularSelection(),
                    engine.crosshairCursor(),
                    engine.highlightActiveLine(),
                    engine.highlightSelectionMatches(),
                    engine.search({
                        top: true,
                        createPanel: filePanel,
                        scrollToMatch: (range, view) => scrolledTo(view, range),
                    }),
                    engine.keymap.of([
                        ...engine.closeBracketsKeymap,
                        ...engine.defaultKeymap,
                        ...engine.searchKeymap,
                        ...engine.historyKeymap,
                        ...engine.foldKeymap,
                        engine.indentWithTab,
                    ]),
                    disk.separatorExtension(text),
                    languageSlot.of(languageFor(path)),
                    LOOK,
                    wrapping.of(wrap ? engine.EditorView.lineWrapping : []),
                    typeface.of(typeNow()),
                    engine.EditorView.updateListener.of((u) => {
                        const f = allFiles().find((x) => x.view === u.view);
                        if (u.selectionSet)
                            u.view.dom.classList.toggle(
                                'sk-selecting',
                                u.state.selection.ranges.some((r) => !r.empty)
                            );
                        if (u.selectionSet && f && f === current()) paintCursor();
                        if (
                            (u.docChanged ||
                                u.geometryChanged ||
                                engine.syntaxTree(u.startState) !== engine.syntaxTree(u.state)) &&
                            f &&
                            f === current()
                        )
                            map.update();
                        if (!u.docChanged || !f) return;
                        keepDrafts();
                        // Typing in a preview keeps it: it is being worked on now, not glanced at.
                        if (f.preview) {
                            f.preview = false;
                            paint();
                        }
                        if (dirty(f) !== f.paintedDirty) paint();
                    }),
                ],
            });

        /* Counts asks onto the screen; an open takes its number when asked, and a slow read gives way
       to anything asked after it (openNow). `space` is written only by these three. fillFront is
       for what nobody asked: it fills only an empty front, or one nothing was asked into since
       `since`, and is not counted, which would pass by what a person is still waiting for. */
        let screenRequests = 0;
        const bringForward = (w, f) => {
            screenRequests += 1;
            space = w;
            if (!w) return;
            w.asked = screenRequests;
            if (f !== undefined) w.current = f;
        };
        const fillFront = (w, f, { since } = {}) => {
            const empty = !space || !spaces.includes(space) || (since !== undefined && !(space.asked > since));
            if (empty) space = w;
            if (w && f !== undefined && !w.current) w.current = f;
        };
        const followFront = (w, f, asked) => {
            space = w;
            w.current = f;
            w.asked = asked;
        };

        // A file only looked at from the tree leaves the keyboard there, for the next row or ⌘⌫.
        const show = (f, { look = false } = {}) => {
            if (!f) return;
            bringForward(spaces.find((x) => x.files.includes(f)) || space, f);
            paint();
            persist();
            space.tree?.reveal(f.path);
            if (!look) requestAnimationFrame(() => f.view.focus());
        };

        const spaceFor = (path) => {
            const holding = spaces
                .filter((w) => w.root && path.startsWith(w.root + '/'))
                .sort((a, b) => b.root.length - a.root.length)[0];
            return holding || spaces.find((w) => !w.root) || null;
        };

        /* Every open, close and replaced preview goes through place and release, so openFiles and
       w.files never disagree, not even while a tab shrinks away. */
        const place = (f, at) => {
            const w = spaceFor(f.path) || addSpace(null);
            w.files.splice(at == null ? w.files.length : Math.min(at, w.files.length), 0, f);
            openFiles.set(f.path, f);
            // Open again, so closing it now takes it out of the session.
            carriedFiles.get(w.root || '')?.delete(f.path);
            return w;
        };
        const unlist = (w, f) => {
            const at = w.files.indexOf(f);
            w.files.splice(at, 1);
            if (w.current === f) w.current = w.files[Math.min(at, w.files.length - 1)] || null;
        };
        const release = (f) => {
            const w = spaces.find((x) => x.files.includes(f));
            if (!w) return null;
            f.view.destroy();
            f.box.remove();
            unlist(w, f);
            openFiles.delete(f.path);
            if (!w.root && !w.files.length) removeSpace(w);
            return w;
        };

        /* A path already being opened is waited for, not read again, so two asks at once are one tab.
       Its place among the asks onto the screen is taken before any waiting. */
        const opening = new Map(); // path -> the open under way
        const tryOpen = async (path, how = {}) => {
            const asked = how.background ? 0 : (screenRequests += 1);
            while (opening.has(path)) await opening.get(path).catch(() => {});
            const under = openNow(path, { ...how, asked });
            opening.set(path, under);
            try {
                return await under;
            } finally {
                if (opening.get(path) === under) opening.delete(path);
            }
        };
        // A file that is not text goes to the system's app only when opened, not when a click in the tree only looks.
        const open = async (path, { background = false, preview = false, look = false } = {}) => {
            const r = await tryOpen(path, { background, preview, look });
            if (r.file) return r.file;
            if (r.passed) return null;
            if (r.refused === 'NOT_TEXT') {
                if (!background && !look) host.open(host.fileURL(path), { userInitiated: true });
            } else ui.dialog({ title: `Could not open ${nameOf(path)}`, message: r.message, confirmLabel: 'OK' });
            return null;
        };
        /* Asks end out of order, since a file not open yet is read first. One that something was asked
       after does not come forward: a preview is passed by, and a kept file opens behind as its tab. */
        const openNow = async (path, { background = false, preview = false, look = false, asked = 0 } = {}) => {
            const behind = () => !background && asked !== screenRequests;
            const had = openFiles.get(path);
            if (had) {
                if (!preview) had.preview = false;
                if (!background && !behind()) show(had, { look });
                else paint();
                return { file: had };
            }
            let got;
            try {
                got = await main.call('read', path);
            } catch (e) {
                if (preview && behind()) return { file: null, passed: true };
                const { kind, message } = failureOf(e);
                return { file: null, refused: kind, message };
            }
            if (preview && behind()) return { file: null, passed: true };
            // A box of its own: the engine insists its element is position: relative, so it cannot be laid over the others.
            const box = el('div', { position: 'absolute', inset: '0', right: map.inset(), visibility: 'hidden' });
            const state = stateFor(got.text, path);
            const view = new engine.EditorView({ state, parent: box });
            /* Sideways wheel scrolling is done here so the scroll and the gutter clip land in the same
         frame; left to the browser, the clip lags a frame and the edge of the code wobbles. */
            view.scrollDOM.addEventListener(
                'wheel',
                (e) => {
                    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
                    e.preventDefault();
                    view.scrollDOM.scrollLeft += e.deltaX;
                    clipGutter(view);
                },
                { passive: false }
            );
            view.scrollDOM.addEventListener('scroll', () => clipGutter(view), { passive: true });
            stage.appendChild(box);
            const f = disk.admit({ path, box, view, preview }, got, drafts()[path]);
            if (dirty(f)) f.preview = false;
            // The workspace is chosen only now, so a folder opened during the read is the one it goes to.
            const holding = spaceFor(path);
            const stale = f.preview && holding ? holding.files.find((x) => x.preview && !dirty(x)) : null;
            const at = stale
                ? holding.files.indexOf(stale)
                : holding?.current
                  ? holding.files.indexOf(holding.current) + 1
                  : null;
            const w = place(f, at);
            if (stale) {
                if (w.current === stale) w.current = f;
                release(stale);
            }
            if (background || behind()) {
                fillFront(w, f);
                paint();
                persist();
            } else show(f, { look });
            return { file: f };
        };

        const keep = (f) => {
            if (f?.preview) {
                f.preview = false;
                paint();
            }
        };

        // Centred, unless all of it is in sight already, where moving the text only loses the place.
        const scrolledTo = (view, range) => {
            const box = view.scrollDOM.getBoundingClientRect();
            const top = view.coordsAtPos(range.from),
                bottom = view.coordsAtPos(range.to);
            const inSight = !!top && !!bottom && top.top >= box.top && bottom.bottom <= box.bottom;
            return engine.EditorView.scrollIntoView(range, { y: inSight ? 'nearest' : 'center' });
        };
        const openAt = async (path, { line, col = 0, length = 0 }) => {
            const f = await open(path, { preview: true });
            if (!f || !line) return;
            const doc = f.view.state.doc;
            const l = doc.line(Math.min(Math.max(1, line), doc.lines));
            const from = Math.min(l.from + col, l.to);
            f.view.dispatch({ selection: { anchor: from, head: Math.min(from + length, l.to) } });
            f.view.dispatch({ effects: scrolledTo(f.view, f.view.state.selection.main) });
            f.view.focus();
        };

        const save = async (f, force = false) => {
            if (!f || (!dirty(f) && !force)) return true;
            try {
                await disk.save(f, { force });
                return true;
            } catch (e) {
                const { kind, message } = failureOf(e);
                if (kind === 'CHANGED') {
                    ui.dialog({
                        title: `${nameOf(f.path)} changed on disk`,
                        message:
                            'Another program wrote to it after it was opened here. Saving now replaces that with what is here.',
                        confirmLabel: 'Save anyway',
                        cancelLabel: 'Cancel',
                        extraLabel: 'Reload from disk',
                        onExtra: () => reload(f, true),
                        destructive: true,
                        onConfirm: () => save(f, true),
                    });
                } else {
                    ui.dialog({ title: `Could not save ${nameOf(f.path)}`, message, confirmLabel: 'OK' });
                }
                return false;
            }
        };
        const saveAll = async (list = files()) => {
            for (const f of list) if (dirty(f)) await save(f);
        };

        const reload = async (f, force = false) => {
            if (!f) return false;
            try {
                return await disk.reload(f, { force });
            } catch (e) {
                const { kind, message } = failureOf(e);
                // Gone: disk.check marks it so, and the notice then offers what is left.
                if (kind === 'GONE') {
                    await disk.check(f).catch(() => false);
                    return false;
                }
                ui.dialog({ title: `Could not reload ${nameOf(f.path)}`, message, confirmLabel: 'OK' });
                return false;
            }
        };

        const drop = (f) => {
            const t = strip.querySelector(`[data-path="${CSS.escape(f.path)}"]`);
            const at = files().indexOf(f);
            /* The keyboard moves on only if it was in what is going, or nowhere: a file trashed from the
         tree leaves it in the tree, for the next ⌘⌫. */
            const active = document.activeElement;
            const follow = f.view.hasFocus || !active || active === document.body || !!t?.contains(active);
            const inFront = current() === f;
            if (!release(f)) return;
            // Counted as an ask: closing is asking for what is left.
            if (inFront) bringForward(space, space?.current ?? null);
            // Closing is the answer to "save changes?", so whatever was not saved is let go.
            forgetDraft(f.path);
            if (t && at >= 0 && theme.motion.base) {
                leaving.set(t, at);
                t.style.pointerEvents = 'none';
                t.style.transition = `background-color ${theme.motion.fast}ms ${theme.motion.easing}, ${TAB_MOVE}`;
                Object.assign(t.style, { maxWidth: '0px', opacity: '0', padding: '0' });
                setTimeout(() => {
                    if (leaving.delete(t)) {
                        t.remove();
                        if (!files().length && !leaving.size) strip.style.display = 'none';
                    }
                }, theme.motion.base);
            }
            paint();
            persist();
            if (follow) current()?.view.focus();
        };
        const pathItems = (path, rel) => [
            { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(path) },
            { label: 'Copy Path', icon: 'copy', run: () => host.clipboard.writeText(path).catch(() => {}) },
            ...(rel ? [{ label: 'Copy Relative Path', run: () => host.clipboard.writeText(rel).catch(() => {}) }] : []),
        ];
        const openUnder = (path) => allFiles().filter((f) => f.path === path || f.path.startsWith(path + '/'));
        // `to` null is the Trash; drafts then stay, since unsaved text outlives its file.
        const relocate = (from, to) => {
            const move = (p) => util.movePath(p, from, to);
            if (to != null) {
                for (const f of openUnder(from)) {
                    const next = move(f.path);
                    openFiles.delete(f.path);
                    // Its tab is the same tab, not a new one growing in.
                    if (drawnTabs.delete(f.path)) drawnTabs.add(next);
                    f.path = next;
                    openFiles.set(next, f);
                    f.view.dispatch({ effects: languageSlot.reconfigure(languageFor(next)) });
                }
                const kept = drafts();
                if (Object.keys(kept).some((p) => move(p) !== p))
                    data.set('drafts', Object.fromEntries(Object.entries(kept).map(([p, d]) => [move(p), d])));
            }
            carried = carried
                .map((c) => ({ ...c, root: c.root && move(c.root), open: (c.open || []).map(move).filter(Boolean) }))
                .filter((c) => c.root !== null);
            for (const [root, paths] of [...carriedFiles]) {
                carriedFiles.delete(root);
                const at = root ? move(root) : root;
                if (at !== null) carriedFiles.set(at, new Set([...paths].map(move).filter(Boolean)));
            }
            for (const w of [...spaces]) {
                w.finder?.follow(move);
                w.tree?.follow(move);
                if (!w.root || move(w.root) === w.root) continue;
                const at = move(w.root);
                if (at) {
                    w.root = at;
                    listFolder(w, true);
                } else if (!w.files.length) removeSpace(w);
            }
            if (recentFolders().some((p) => move(p) !== p))
                data.set('recent-folders', recentFolders().map(move).filter(Boolean));
            paint();
            persist();
        };
        // Open files under it are held (disk.holding), so no save of theirs lands on the old path.
        const renameIn = async (w, from, label, { stem }) => {
            let at = from;
            await ui.inlineEdit(label, {
                stem,
                commit: async (name) => {
                    try {
                        await disk.holding(openUnder(from), async () => {
                            at = await main.call('rename', from, name);
                            relocate(from, at);
                        });
                    } catch (e) {
                        return failureOf(e).message;
                    }
                },
            });
            if (at !== from) {
                await w.tree.refresh();
                listFolder(w, true);
            }
            return at;
        };
        const moveEntry = async (w, entry, dir) => {
            let at = null;
            try {
                await disk.holding(openUnder(entry.path), async () => {
                    at = await main.call('move', entry.path, dir);
                    relocate(entry.path, at);
                });
            } catch (e) {
                ui.dialog({ title: `Could not move ${entry.name}`, message: failureOf(e).message, confirmLabel: 'OK' });
                return;
            }
            // relocate has the trees follow the move, which reads them again.
            listFolder(w, true);
            if (at) w.tree.reveal(at);
        };
        const renameEntry = async (w, entry) => {
            const label = await w.tree.nameAt(entry.path);
            if (label) await renameIn(w, entry.path, label, { stem: !entry.folder });
        };
        const newEntry = async (w, dir, kind) => {
            let made;
            try {
                made = await main.call(kind === 'folder' ? 'mkdir' : 'create', dir);
            } catch (e) {
                ui.dialog({ title: `Could not make a new ${kind}`, message: failureOf(e).message, confirmLabel: 'OK' });
                return;
            }
            switchTo(w);
            setMode('files');
            listFolder(w, true);
            const label = await w.tree.nameAt(made);
            const named = label ? await renameIn(w, made, label, { stem: false }) : made;
            if (kind === 'file') open(named, { preview: false });
        };
        const newHere = (kind) => {
            const w = space,
                f = current();
            if (!w?.root) return;
            const picked = w.tree.picked();
            const dir = picked
                ? picked.folder
                    ? picked.path
                    : picked.path.slice(0, picked.path.lastIndexOf('/'))
                : f && f.path.startsWith(w.root + '/')
                  ? f.path.slice(0, f.path.lastIndexOf('/'))
                  : w.root;
            newEntry(w, dir, kind);
        };
        const trashEntry = (w, entry) => {
            const send = async () => {
                const under = openUnder(entry.path);
                try {
                    await disk.holding(under, () => main.call('trash', entry.path));
                } catch (e) {
                    ui.dialog({
                        title: `Could not move ${entry.name} to the Trash`,
                        message: failureOf(e).message,
                        confirmLabel: 'OK',
                    });
                    return;
                }
                for (const f of under) {
                    if (dirty(f)) disk.check(f).catch(() => false);
                    else drop(f);
                }
                relocate(entry.path, null);
                await w.tree.refresh();
                listFolder(w, true);
            };
            if (!entry.folder) return send();
            ui.dialog({
                title: `Move \u201c${entry.name}\u201d to the Trash?`,
                destructive: true,
                confirmLabel: 'Move to Trash',
                message: 'The folder and everything in it go to the macOS Trash, from where Finder can put them back.',
                onConfirm: send,
            });
        };

        ui.contextMenu(strip, {
            rowAt: (t) => t.closest?.('[data-path]') || null,
            items: (t) => {
                const f = t && files().find((x) => x.path === t.dataset.path);
                if (!f) return null;
                const rel =
                    space?.root && f.path.startsWith(space.root + '/') ? f.path.slice(space.root.length + 1) : '';
                return [
                    { label: 'Close', icon: 'x', hint: host.chordOf('closeFile'), run: () => close(f) },
                    '-',
                    ...(rel
                        ? [
                              {
                                  label: 'Reveal in Files',
                                  icon: 'folders',
                                  hint: host.chordOf('reveal'),
                                  run: () => revealInFiles(f),
                              },
                          ]
                        : []),
                    ...pathItems(f.path, rel),
                ];
            },
        });
        const revealInFiles = async (f) => {
            if (!f || !space?.root || !f.path.startsWith(space.root + '/')) return;
            setMode('files');
            const tree = space.tree;
            await tree.reveal(f.path);
            tree.focus();
        };
        const stepTab = (by) => {
            const list = space?.files || [],
                at = list.indexOf(current());
            if (list.length > 1) show(list[(at + by + list.length) % list.length]);
        };
        const close = (f) => {
            if (!f) return;
            if (!dirty(f)) return drop(f);
            ui.dialog({
                title: `Save changes to ${nameOf(f.path)}?`,
                message: 'Closing without saving loses them.',
                confirmLabel: 'Save',
                cancelLabel: 'Cancel',
                extraLabel: "Don't save",
                onExtra: () => drop(f),
                onConfirm: async () => {
                    if (await save(f)) drop(f);
                },
            });
        };

        const checkDisk = async () => {
            for (const f of allFiles()) await disk.check(f).catch(() => false);
        };

        /* Through the editor, not straight to disk: an open file with unsaved changes is skipped, since
       its lines may not be the ones the search read. */
        const replaceAll = async (results, { query, replacement, opts }) => {
            let replaced = 0,
                skipped = 0,
                why = '';
            const tally = (plan) => {
                replaced += plan.edits.length;
                skipped += plan.skipped;
                why = why || plan.why;
            };
            const pass = (count, reason) => {
                skipped += count;
                why = why || reason;
            };
            for (const { path, matches, mtime } of results) {
                const f = openFiles.get(path);
                if (f) {
                    if (dirty(f)) {
                        pass(matches.length, `${nameOf(path)} has unsaved changes`);
                        continue;
                    }
                    if (mtime && Math.abs(f.mtime - mtime) > 1) {
                        pass(matches.length, `${nameOf(path)} changed after the search`);
                        continue;
                    }
                    const doc = f.view.state.doc;
                    const plan = planReplace((n) => (n >= 1 && n <= doc.lines ? doc.line(n) : null), matches, {
                        query,
                        replacement,
                        opts,
                    });
                    if (!plan.edits.length) {
                        tally(plan);
                        continue;
                    }
                    // Counted as replaced once it is on disk, which is what the count tells the person.
                    f.view.dispatch({ changes: plan.edits });
                    if (await save(f)) tally(plan);
                    else pass(matches.length, `${nameOf(path)} could not be saved`);
                    continue;
                }
                try {
                    let plan = null;
                    await disk.writeUnopened(path, mtime, (text) => {
                        plan = planReplace(linesOfText(text), matches, { query, replacement, opts });
                        return plan.edits.length ? applyEdits(text, plan.edits) : null;
                    });
                    tally(plan);
                } catch (e) {
                    const { kind, message } = failureOf(e);
                    pass(
                        matches.length,
                        kind === 'CHANGED'
                            ? `${nameOf(path)} changed after the search`
                            : `${nameOf(path)} could not be changed (${message})`
                    );
                }
            }
            paint();
            return { replaced, skipped, why };
        };

        const marksFor = (w) => ({
            file: (p) => ({ dirty: dirty(w.files.find((x) => x.path === p)) }),
            folder: (p) => ({ dirty: w.files.some((f) => f.path.startsWith(p + '/') && dirty(f)) }),
        });
        const addSpace = (root, { mode = 'files' } = {}) => {
            const w = { root, files: [], current: null, fileList: null, mode, tree: null, finder: null };
            if (root) {
                const findIn = (rel) => {
                    setMode('search');
                    w.finder.within(rel);
                };
                w.tree = fileTree({
                    theme,
                    ui,
                    store,
                    main,
                    marks: marksFor(w),
                    onOpen: (p, o) => open(p, o),
                    onFindIn: findIn,
                    onMove: (entry, dir) => moveEntry(w, entry, dir),
                    // `entry` null is the space around the rows: the top folder.
                    menu: (entry) => {
                        const dir = !entry ? w.root : entry.folder ? entry.path : null;
                        const make = dir
                            ? [
                                  {
                                      label: 'New File',
                                      icon: 'filePlus',
                                      hint: host.chordOf('newFile'),
                                      run: () => newEntry(w, dir, 'file'),
                                  },
                                  {
                                      label: 'New Folder',
                                      icon: 'folderPlus',
                                      hint: host.chordOf('newFolder'),
                                      run: () => newEntry(w, dir, 'folder'),
                                  },
                              ]
                            : [];
                        if (!entry) return [...make, '-', ...pathItems(w.root, '')];
                        const rel = entry.path.slice(w.root.length + 1);
                        return [
                            entry.folder
                                ? { label: 'Find in Folder', icon: 'search', run: () => findIn(rel) }
                                : { label: 'Open', icon: 'fileText', run: () => open(entry.path, { preview: false }) },
                            ...(make.length ? ['-', ...make] : []),
                            '-',
                            { label: 'Rename\u2026', icon: 'pencil', run: () => renameEntry(w, entry) },
                            {
                                label: 'Move to Trash',
                                icon: 'trash',
                                hint: host.chordOf('trash'),
                                run: () => trashEntry(w, entry),
                            },
                            '-',
                            ...pathItems(entry.path, rel),
                        ];
                    },
                });
                w.finder = folderSearch({
                    theme,
                    ui,
                    main,
                    root: () => w.root,
                    onOpen: (p, m) => openAt(p, m),
                    onReplaceAll: replaceAll,
                    folders: async () => foldersOf(await listFolder(w)),
                    ranker: util.ranker,
                });
            }
            spaces.push(w);
            return w;
        };
        const removeSpace = (w) => {
            const at = spaces.indexOf(w);
            if (at < 0) return;
            spaces.splice(at, 1);
            w.finder?.close();
            // Not counted here: when a person closed it, the closer counts the ask.
            if (space === w) fillFront(spaces[Math.min(at, spaces.length - 1)] || null);
        };

        const listFolder = (w, fresh = false) => {
            if (!w?.root) return null;
            if (fresh || !w.fileList) {
                const made = main.call('files', w.root, { fresh });
                w.fileList = made;
                made.catch(() => {
                    if (w.fileList === made) w.fileList = null;
                });
            }
            return w.fileList;
        };
        const folderLists = new WeakMap();
        const foldersOf = (listed) => {
            if (!listed) return [];
            if (!folderLists.has(listed)) {
                const found = new Set();
                for (const rel of listed.files)
                    for (let i = rel.indexOf('/'); i > 0; i = rel.indexOf('/', i + 1)) found.add(rel.slice(0, i));
                folderLists.set(listed, [...found].sort());
            }
            return folderLists.get(listed);
        };
        // `fromSession` is said by the caller, not read off `restoring`: a person opening a folder mid-restore asked for it.
        const openFolder = async (path, { mode = 'files', fromSession = false } = {}) => {
            let w = spaces.find((x) => x.root === path);
            if (!w) {
                w = addSpace(path, { mode });
                settle(path);
                // Open files inside it move in: a file belongs to the deepest open folder that holds it.
                for (const from of spaces.filter((x) => x !== w)) {
                    for (const f of from.files.filter((x) => spaceFor(x.path) === w)) {
                        const inFront = space === from && from.current === f;
                        unlist(from, f);
                        w.files.push(f);
                        if (inFront) followFront(w, f, from.asked);
                        else if (!w.current) w.current = f;
                    }
                }
                const loose = spaces.find((x) => !x.root);
                if (loose && !loose.files.length) removeSpace(loose);
                await w.tree.setRoot(path);
                listFolder(w, true);
            }
            if (!fromSession) {
                data.set('recent-folders', [path, ...recentFolders().filter((p) => p !== path)].slice(0, RECENT_KEEP));
                bringForward(w);
                paint();
                persist();
            }
            return w;
        };
        const switchTo = (w) => {
            if (!w || w === space) return;
            bringForward(w);
            paint();
            persist();
            w.tree?.refresh();
            listFolder(w, true);
            current()?.view.focus();
        };
        const closeSpace = (w) => {
            const finish = () => {
                const inFront = space === w;
                for (const f of [...w.files]) {
                    release(f);
                    forgetDraft(f.path);
                }
                removeSpace(w);
                // Counted as an ask: closing is asking for what is left.
                if (inFront) bringForward(space, space?.current ?? null);
                settle(w.root);
                paint();
                persist();
            };
            const unsaved = w.files.filter(dirty);
            if (!unsaved.length) return finish();
            ui.dialog({
                title: `Close ${w.root ? nameOf(w.root) : 'Files'}?`,
                message: `${unsaved.length} file${unsaved.length === 1 ? ' has' : 's have'} unsaved changes: ${unsaved.map((f) => nameOf(f.path)).join(', ')}.`,
                confirmLabel: 'Save and close',
                cancelLabel: 'Cancel',
                extraLabel: 'Close without saving',
                onExtra: finish,
                onConfirm: async () => {
                    await saveAll(unsaved);
                    if (!w.files.some(dirty)) finish();
                },
            });
        };

        const pickFolder = async () => {
            let paths = [];
            try {
                paths = await main.call('pick', 'folder');
            } catch {
                return;
            }
            if (paths[0]) openFolder(paths[0]);
        };
        const pickFiles = async () => {
            let paths = [];
            try {
                paths = await main.call('pick', 'file');
            } catch {
                return;
            }
            for (const p of paths) await open(p);
        };

        /* A basis of 0: the host never lets a plugin's sidebar shrink, and one sized by its content
       would scroll the whole column. The negative margin puts the scrollbar on the sidebar's edge. */
        const sidebar = el('div', {
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0',
            minHeight: '0',
            overflow: 'hidden',
            margin: '0 -12px',
        });
        const openMenu = (button) => {
            const recent = recentFolders().filter((p) => !spaces.some((w) => w.root === p));
            ui.menu(
                [
                    {
                        label: 'Open Folder\u2026',
                        icon: 'folder',
                        hint: host.chordOf('openFolder'),
                        run: () => pickFolder(),
                    },
                    {
                        label: 'Open File\u2026',
                        icon: 'fileText',
                        hint: host.chordOf('openFile'),
                        run: () => pickFiles(),
                    },
                    ...(recent.length
                        ? [
                              '-',
                              {
                                  label: 'Open Recent',
                                  icon: 'clock',
                                  items: recent.map((p) => ({
                                      label: nameOf(p),
                                      hint: tilde(p),
                                      run: () => openFolder(p),
                                  })),
                              },
                          ]
                        : []),
                ],
                { anchor: button }
            );
        };
        const spaceSection = ui.section('Workspaces', {
            icon: ui.icon('folders', 16),
            actions: [{ title: 'Open', run: openMenu }],
        });
        const spaceList = ui.list({ most: 4 });
        spaceSection.body.appendChild(spaceList);
        ui.sortable(spaceList, (from, to) => {
            const [w] = spaces.splice(from, 1);
            spaces.splice(to, 0, w);
            persist();
            renderSpaces();
        });

        const lead = (svg) => {
            const g = el('span', { display: 'flex' });
            g.innerHTML = svg;
            return g;
        };
        const navBar = ui.segmented(
            [
                { key: 'files', label: 'Files', title: 'Files', lead: lead(ui.icon('fileText', 13)) },
                { key: 'search', label: 'Find', title: 'Find in the workspace', lead: lead(ui.icon('search', 13)) },
            ],
            { value: 'files', size: 'sm', onChange: (key) => setMode(key) }
        );
        navBar.style.alignSelf = 'stretch';
        for (const b of navBar.children) {
            b.style.flex = '1 1 0';
            b.style.justifyContent = 'center';
        }
        ui.tip(navBar.children[0], 'Files', () => host.chordOf('showFiles'));
        ui.tip(navBar.children[1], 'Find in the workspace', () => host.chordOf('showFind'));
        const navHead = el('div', { display: 'flex', flexDirection: 'column', flex: '0 0 auto', minWidth: '0' });
        const top = el('div', {
            display: 'flex',
            flexDirection: 'column',
            flex: '0 0 auto',
            gap: '10px',
            padding: '0 12px 6px',
        });
        top.append(spaceSection, navBar, navHead);
        const navBody = el('div', {
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: '0',
            minWidth: '0',
            overflowY: 'auto',
            padding: '0 12px',
        });
        ui.scrollFade(navBody);
        sidebar.append(top, navBody);

        // Through whenFree: a workspace being dragged keeps its row until it is let go.
        const renderSpaces = () => ui.whenFree(spaceList, drawSpaces);
        let frontDrawn = null; // the workspace in front when the list was last drawn
        const drawSpaces = () => {
            spaceList.textContent = '';
            for (const w of spaces) {
                const r = ui.row();
                const glyph = el('span', { display: 'flex', flex: '0 0 auto' });
                glyph.innerHTML = w.root ? ui.folderIcon(w === space, 16) : ui.icon('fileText', 16);
                const label = el(
                    'span',
                    { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' },
                    w.root ? nameOf(w.root) : 'Files'
                );
                r.title = w.root || 'Files opened on their own';
                r.append(glyph, label);
                if (spaceDirty(w))
                    r.appendChild(
                        el('span', {
                            flex: '0 0 auto',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: 'currentColor',
                            opacity: '.7',
                        })
                    );
                r.appendChild(ui.miniBtn(ui.icon('x', 14), 'Close workspace', () => closeSpace(w)));
                r.addEventListener('click', () => switchTo(w));
                ui.hoverable(r, () => w === space);
                spaceList.appendChild(r);
            }
            if (!spaces.length) {
                const r = ui.row();
                const g = el('span', { display: 'flex', opacity: '.6' });
                g.innerHTML = ui.icon('plus', 15);
                r.append(g, el('span', { opacity: '.7' }, 'Open Folder…'));
                r.addEventListener('click', () => pickFolder());
                ui.hoverable(r);
                spaceList.appendChild(r);
            }
            // Only when the front changes, so a list scrolled by hand stays where it was put.
            const front = spaceList.children[spaces.indexOf(space)];
            if (front && space !== frontDrawn && !ui.inSight(front)) front.scrollIntoView({ block: 'nearest' });
            frontDrawn = space;
        };

        // Redrawn only when what it shows changes: the tree and the search keep their own state.
        let drawn = null;
        const renderNav = () => {
            const w = space;
            const want = w ? (w.root || '') + '|' + w.mode : '';
            navBody.style.display = w ? 'flex' : 'none';
            navBar.style.display = w?.root ? 'flex' : 'none';
            if (!w || drawn === want) return;
            drawn = want;
            navBody.textContent = '';
            navHead.textContent = '';
            if (!w.root) {
                navBar.style.display = 'none';
                for (const f of w.files) {
                    const r = ui.row({ dense: true });
                    const g = el('span', { display: 'flex' });
                    g.innerHTML = fileIcons.file(nameOf(f.path), 14);
                    r.append(
                        g,
                        el(
                            'span',
                            { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' },
                            nameOf(f.path)
                        )
                    );
                    r.title = f.path;
                    r.addEventListener('click', () => show(f));
                    ui.hoverable(r, () => f === w.current);
                    navBody.appendChild(r);
                }
                drawn = null; // a list of its files, so redrawn whenever the files change
                return;
            }
            navBar.style.display = 'flex';
            navBar.setValue(w.mode);
            navHead.textContent = '';
            if (w.mode === 'search') navHead.appendChild(w.finder.head);
            navBody.appendChild(w.mode === 'search' ? w.finder.element : w.tree.element);
        };
        const renderSide = () => {
            renderSpaces();
            renderNav();
            space?.tree?.repaint();
        };
        const setMode = (next) => {
            if (!space?.root) return;
            space.mode = next;
            persist();
            drawn = null;
            renderNav();
            if (next === 'search') {
                const f = current();
                const sel = f
                    ? f.view.state.sliceDoc(f.view.state.selection.main.from, f.view.state.selection.main.to)
                    : '';
                space.finder.focus(sel && !sel.includes('\n') ? sel : '');
            }
        };

        const quick = quickOpen({
            theme,
            ui,
            ranker: util.ranker,
            root: () => space?.root || null,
            onOpen: (p) => open(p),
            list: () => listFolder(space),
        });

        /* A person may already be asking for things (a file opened from the Finder starts the editor),
       so what is asked after this begins stays in front. */
        const restore = async () => {
            const asked = screenRequests;
            const s = data.get('session', null) || {};
            try {
                for (const ws of Array.isArray(s.spaces) ? s.spaces : []) {
                    try {
                        if (ws.root) {
                            const st = await main.call('stat', ws.root);
                            if (!st.exists) continue; // the folder is gone: the one way a workspace leaves on its own
                            await openFolder(ws.root, {
                                mode: ws.mode === 'search' ? 'search' : 'files',
                                fromSession: true,
                            });
                        }
                        const kept = [];
                        for (const p of Array.isArray(ws.open) ? ws.open : []) {
                            const r = await tryOpen(p, { background: true });
                            if (!r.file && r.refused !== 'GONE' && r.refused !== 'NOT_TEXT') kept.push(p);
                        }
                        const w = ws.root ? spaces.find((x) => x.root === ws.root) : spaces.find((x) => !x.root);
                        if (w && !(w.asked > asked))
                            w.current = w.files.find((f) => f.path === ws.active) || w.files[0] || null;
                        if (kept.length && w) carriedFiles.set(ws.root || '', new Set(kept));
                        else if (kept.length) carried.push({ ...ws, open: kept });
                    } catch (e) {
                        console.warn('[deckit] editor could not bring back a workspace', ws.root, e);
                        carried.push(ws);
                    }
                }
                fillFront(spaces.find((w) => (w.root || '') === s.active) || spaces[0] || null, undefined, {
                    since: asked,
                });
            } finally {
                restoring = false;
            }
            persist();
            paint();
        };

        restore();

        const findInFile = (replace) => {
            const f = current();
            if (!f) return;
            engine.openSearchPanel(f.view);
            const bar = panels.get(f.view);
            if (replace) bar?.setReplaceOpen(true);
            else bar?.focus();
        };

        return {
            content,
            sidebar,
            didAppear: () => {
                checkDisk();
                space?.tree?.refresh();
                listFolder(space, true);
                current()?.view.focus();
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
                quickOpen: { key: 'mod+p', label: 'Open Quickly', run: () => quick.show() },
                showFiles: { key: 'mod+1', label: 'Show the files', run: () => setMode('files') },
                showFind: { key: 'mod+3', label: 'Show find', run: () => setMode('search') },
                reveal: { key: 'mod+shift+j', label: 'Reveal in the files', run: () => revealInFiles(current()) },
                openFolder: { key: 'mod+o', label: 'Open a folder', run: () => pickFolder() },
                openFile: { key: 'mod+alt+o', label: 'Open a file', run: () => pickFiles() },
                newFile: { key: 'mod+n', label: 'New file', run: () => newHere('file') },
                newFolder: { key: 'mod+alt+n', label: 'New folder', run: () => newHere('folder') },
                // Only the row picked in the tree; elsewhere ⌘⌫ is a text field's.
                trash: {
                    key: 'mod+backspace',
                    label: 'Move to Trash',
                    run: () => {
                        const e = space?.tree?.picked();
                        if (e) trashEntry(space, e);
                    },
                },
                previousTab: { key: 'mod+shift+[', label: 'Previous tab', run: () => stepTab(-1) },
                nextTab: { key: 'mod+shift+]', label: 'Next tab', run: () => stepTab(1) },
                save: { key: 'mod+s', label: 'Save', run: () => save(current()) },
                saveAll: { key: 'mod+alt+s', label: 'Save all', run: () => saveAll(allFiles()) },
                closeFile: { key: 'mod+w', label: 'Close file', run: () => close(current()) },
                find: { key: 'mod+f', label: 'Find in file', run: () => findInFile(false) },
                replace: { key: 'mod+alt+f', label: 'Replace in file', run: () => findInFile(true) },
                searchFolder: { key: 'mod+shift+f', label: 'Find in the workspace', run: () => setMode('search') },
                goToLine: {
                    key: 'mod+l',
                    label: 'Go to line',
                    run: () => {
                        const f = current();
                        if (f) engine.gotoLine(f.view);
                    },
                },
                wrapLines: { key: 'alt+z', label: 'Wrap lines', run: () => setWrap(!wrap) },
            },

            commands: () => [
                {
                    label: 'Open Folder\u2026',
                    icon: ui.icon('folder', 16),
                    keywords: ['열기', '폴더', '워크스페이스', 'open', 'folder', 'workspace', 'project'],
                    run: () => {
                        host.show();
                        pickFolder();
                    },
                },
                {
                    label: 'Open File\u2026',
                    icon: ui.icon('fileText', 16),
                    keywords: ['열기', '파일', 'open', 'file'],
                    run: () => {
                        host.show();
                        pickFiles();
                    },
                },
                ...(space?.root
                    ? [
                          {
                              label: 'New File in ' + nameOf(space.root),
                              icon: ui.icon('filePlus', 16),
                              keywords: ['새 파일', '파일', '만들기', 'new', 'file', 'create'],
                              run: () => {
                                  host.show();
                                  newHere('file');
                              },
                          },
                      ]
                    : []),
                ...spaces
                    .filter((w) => w.root)
                    .map((w) => ({
                        group: 'Workspaces',
                        label: nameOf(w.root),
                        hint: tilde(w.root),
                        icon: ui.icon('folders', 16),
                        keywords: ['워크스페이스', 'workspace'],
                        address: w.root,
                        run: () => {
                            host.show();
                            switchTo(w);
                        },
                    })),
                ...recentFolders()
                    .filter((p) => !spaces.some((w) => w.root === p))
                    .map((p) => ({
                        group: 'Recent Folders',
                        label: nameOf(p),
                        hint: tilde(p),
                        icon: ui.icon('folder', 16),
                        keywords: ['폴더', 'folder'],
                        address: p,
                        run: () => {
                            host.show();
                            openFolder(p);
                        },
                    })),
                ...spaces
                    .filter((w) => w.root)
                    .sort((a, b) => (b === space) - (a === space))
                    .map((w) => ({
                        label: 'Search Files in ' + nameOf(w.root),
                        hint: tilde(w.root),
                        icon: ui.icon('search', 16),
                        keywords: [
                            '파일',
                            '검색',
                            '열기',
                            'file',
                            'open',
                            'quick',
                            'find',
                            'workspace',
                            nameOf(w.root),
                        ],
                        page: {
                            placeholder: 'Search files in ' + nameOf(w.root),
                            search: async (query) => {
                                let listed;
                                try {
                                    listed = await listFolder(w);
                                } catch (e) {
                                    return [
                                        {
                                            label: 'Could not list the files',
                                            hint: failureOf(e).message,
                                            icon: ui.icon('search', 16),
                                        },
                                    ];
                                }
                                return (await quick.rank(listed?.files || [], query)).map((rel) => ({
                                    label: nameOf(rel),
                                    hint: rel.split('/').slice(0, -1).join('/') || nameOf(w.root),
                                    icon: fileIcons.file(nameOf(rel), 16),
                                    run: () => {
                                        host.show();
                                        switchTo(w);
                                        open(w.root + '/' + rel);
                                    },
                                }));
                            },
                        },
                    })),
            ],
        };
    },
});
