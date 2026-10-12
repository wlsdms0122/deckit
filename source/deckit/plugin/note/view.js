// "system" is the face the rest of the panel is in.
const NOTE_FONTS = [
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
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`,

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
            options: ({ ui }) => ui.installedFonts(NOTE_FONTS),
        },
    },

    make({ theme, ui, storage, host, main, settings, util }) {
        const { values: store } = storage;
        const el = (tag, style = {}, text) => {
            const e = document.createElement(tag);
            Object.assign(e.style, style);
            if (text != null) e.textContent = text;
            return e;
        };
        const quiet = theme.color.muted;
        // Lucide (ISC), for the glyphs the kit does not carry.
        const GLYPH = {
            compose: `<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>`,
            notes: `<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>`,
        };
        const glyph = (name, size = 16) =>
            GLYPH[name]
                ? `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${GLYPH[name]}</svg>`
                : ui.icon(name, size);

        // Paths are relative to the notes folder: "" is the folder itself, "Release/5.280.md" a note.
        const baseName = (rel) => rel.split('/').pop() || '';
        const parentOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
        const noteName = (rel) => baseName(rel).replace(/\.md$/i, '');
        const within = (rel, folder) => rel === folder || rel.startsWith(folder + '/');
        const kindOf = (e) => e?.kind || '';
        const said = (e) => String(e?.message || e);

        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const pad = (n) => String(n).padStart(2, '0');
        const dayStart = (ms) => {
            const d = new Date(ms);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        };
        const daysAgo = (ms) => Math.round((dayStart(Date.now()) - dayStart(ms)) / 86400000);
        const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const shortDate = (ms) => {
            const d = new Date(ms),
                n = daysAgo(ms);
            if (n === 0) return clock(d);
            if (n === 1) return 'Yesterday';
            if (n > 1 && n < 7) return DAYS[d.getDay()];
            return d.getFullYear() === new Date().getFullYear()
                ? `${MONTHS[d.getMonth()]} ${d.getDate()}`
                : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        };
        const longDate = (ms) => {
            const d = new Date(ms);
            return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${clock(d)}`;
        };

        let tree = { name: '', rel: '', folders: [], notes: [], count: 0 };
        let here = (() => {
            const was = store.get('at', null);
            return was && (was.kind === 'folder' || was.kind === 'note') && typeof was.rel === 'string'
                ? was
                : { kind: 'folder', rel: '' };
        })();
        const back = [],
            ahead = [];
        let expanded = new Set(store.get('expanded', []));
        let query = '';
        let hits = null,
            searchPartial = false;
        let cards = { rel: null, notes: [], seq: 0 };

        const nodeAt = (rel) => {
            if (!rel) return tree;
            let node = tree;
            for (const part of rel.split('/')) {
                node = node.folders.find((f) => f.name === part);
                if (!node) return null;
            }
            return node;
        };
        const folderList = () => {
            const out = [];
            const walk = (node, depth) => {
                for (const f of node.folders) {
                    out.push({ rel: f.rel, name: f.name, depth, hasChildren: f.folders.length + f.notes.length > 0 });
                    walk(f, depth + 1);
                }
            };
            walk(tree, 0);
            return out;
        };
        const folderName = (rel) => (rel ? baseName(rel) : 'All Notes');
        const currentFolder = () => (here.kind === 'folder' ? here.rel : parentOf(here.rel));
        const persistHere = () => store.set('at', here);
        const same = (a, b) => a && b && a.kind === b.kind && a.rel === b.rel;
        const reveal = (rel) => {
            let changed = false;
            for (let p = parentOf(rel); p; p = parentOf(p))
                if (!expanded.has(p)) {
                    expanded.add(p);
                    changed = true;
                }
            if (changed) store.set('expanded', [...expanded]);
        };

        const content = el('div', {
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: theme.color.text,
            font: '13px ' + theme.font,
        });
        const keyed = (el, text, action) => ui.tip(el, text, () => host.chordOf(action));
        const keepFocus = (b) => {
            b.addEventListener('mousedown', (e) => e.preventDefault());
            return b;
        };

        const MOVE = 'note';
        const dropZone = (zone, folderAt) =>
            ui.folderDrop(zone, {
                kind: MOVE,
                path: (held) => held.rel,
                folderAt,
                onDrop: (held, t) =>
                    moveTo(held.rel, t.folder, held.since, t.seq ?? (t.row ? Number(t.row.el.dataset.seq) : relocSeq)),
            });
        const pickUp = (item) => {
            const rel = item.dataset.rel || item.dataset.folder;
            if (!rel) return null;
            const name = item.querySelector('[data-name]')?.textContent;
            return {
                kind: MOVE,
                payload: { rel, since: Number(item.dataset.seq) },
                text: name,
                icon: item.dataset.rel ? glyph('fileText', 14) : ui.folderIcon(false, 14),
            };
        };

        const navBar = () => {
            const bar = el('div', {
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                flex: '0 0 auto',
                padding: '8px 12px 6px',
                minHeight: '30px',
            });
            const backBtn = keyed(
                keepFocus(ui.iconBtn(ui.icon('chevronLeft', 16), 'Back', () => goBack(), { size: 'sm' })),
                'Back',
                'back'
            );
            const aheadBtn = keyed(
                keepFocus(ui.iconBtn(ui.icon('chevronRight', 16), 'Forward', () => goAhead(), { size: 'sm' })),
                'Forward',
                'forward'
            );
            const crumbs = ui.breadcrumb({ onGo: (rel) => showFolder(rel) });
            crumbs.style.margin = '0 6px';
            const right = el('div', { display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' });
            bar.append(backBtn, aheadBtn, crumbs, right);
            dropZone(crumbs, (at) => {
                const b = at.closest?.('[data-crumb]');
                return b ? { folder: b.dataset.crumb, mark: b } : null;
            });
            const paint = (rel, { leaf = true } = {}) => {
                backBtn.setEnabled(back.length > 0);
                aheadBtn.setEnabled(ahead.length > 0);
                const parts = [''];
                if (rel) rel.split('/').forEach((_, i, all) => parts.push(all.slice(0, i + 1).join('/')));
                crumbs.setParts(
                    parts.map((p, i) => ({
                        key: p,
                        label: folderName(p),
                        icon: 'folder',
                        current: i === parts.length - 1 && leaf,
                    }))
                );
            };
            return { bar, right, paint };
        };

        const galleryPane = el('div', { display: 'none', flexDirection: 'column', flex: '1 1 auto', minHeight: '0' });
        const galleryNav = navBar();
        let searchSeq = 0;
        const search = ui.field({
            placeholder: 'Search all notes',
            size: 'sm',
            icon: ui.icon('search', 13),
            clearable: true,
            onInput: (v) => runSearch(v),
            onEnter: () => {
                const first = hits?.[0];
                if (first) openAt(first.rel);
            },
            onEscape: () => {
                search.setValue('');
                runSearch('');
            },
        });
        Object.assign(search.style, { flex: '0 1 220px', minWidth: '140px' });
        galleryNav.right.append(
            search,
            keyed(
                keepFocus(
                    ui.iconBtn(glyph('folderPlus', 16), 'New folder', () => newFolder(currentFolder()), { size: 'sm' })
                ),
                'New folder',
                'newFolder'
            ),
            keyed(
                keepFocus(ui.iconBtn(glyph('compose', 16), 'New note', () => newNote(), { size: 'sm' })),
                'New note',
                'newNote'
            )
        );
        const galleryBody = el('div', {
            flex: '1 1 auto',
            minHeight: '0',
            overflowY: 'auto',
            padding: '6px 24px 28px',
            outline: 'none',
            position: 'relative',
        });
        galleryBody.tabIndex = 0;
        ui.scrollFade(galleryBody);
        galleryPane.append(galleryNav.bar, galleryBody);

        const notePane = el('div', {
            display: 'none',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: '0',
            position: 'relative',
        });
        const noteNav = navBar();
        const moreBtn = keepFocus(
            ui.iconBtn(
                ui.icon('ellipsis', 16),
                'More',
                () => {
                    if (note.rel) ui.menu(noteItems(note.rel), { anchor: moreBtn });
                },
                { size: 'sm' }
            )
        );
        noteNav.right.appendChild(moreBtn);
        const head = el('div', { flex: '0 0 auto', width: '100%', padding: '6px 28px 6px', boxSizing: 'border-box' });
        const titleInput = el('input', {
            width: '100%',
            boxSizing: 'border-box',
            border: '0',
            outline: 'none',
            background: 'transparent',
            padding: '0',
            color: theme.color.text,
            font: '800 26px ' + theme.font,
            letterSpacing: '-.01em',
        });
        titleInput.spellcheck = false;
        titleInput.placeholder = 'Untitled';
        const stamp = el('div', { font: '11.5px ' + theme.font, color: quiet, minHeight: '16px', marginTop: '3px' });
        const titleError = el('div', { font: '12px ' + theme.font, color: theme.color.alert, minHeight: '0' });
        head.append(titleInput, titleError, stamp);
        const banner = el('div', {
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            flex: '0 0 auto',
            margin: '4px 16px 6px',
            padding: '7px 8px 7px 12px',
            borderRadius: '8px',
            background: ui.alpha(theme.color.warn, 0.16),
            font: '12.5px ' + theme.font,
        });
        // A face not in the list (chosen on another Mac) falls back to the theme's.
        const typeNow = () => {
            const face = NOTE_FONTS.find((f) => f.value === settings.get('font'))?.font;
            return { size: settings.get('textSize'), font: face ? `${face}, ${theme.font}` : theme.font };
        };
        const editor = noteLive({
            theme,
            ui,
            host,
            match: util.match,
            type: typeNow(),
            onChange: () => edited(),
            onOpenNote: (href) => openLinked(href),
            onMenu: (e, href) => pageMenu(e, href),
        });
        const applyType = () => {
            const type = typeNow();
            editor.setType(type);
            titleInput.style.fontFamily = type.font;
        };
        applyType();
        notePane.append(noteNav.bar, head, banner, editor.element);
        content.append(galleryPane, notePane);

        const sortKey = () => settings.get('sort');
        const sorted = (list) => {
            const k = sortKey();
            if (k === 'name')
                return [...list].sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                );
            return [...list].sort((a, b) =>
                k === 'created' ? (b.birth || b.mtime) - (a.birth || a.mtime) : b.mtime - a.mtime
            );
        };
        const grid = () =>
            el('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' });
        const groupHead = (text) =>
            el('div', { font: '700 12px ' + theme.font, color: quiet, margin: '16px 2px 8px' }, text);
        const card = (style) => {
            const c = el('div', {
                borderRadius: '10px',
                background: 'rgba(128,128,128,.08)',
                cursor: 'default',
                boxSizing: 'border-box',
                minWidth: '0',
                transition: `background-color ${theme.motion.fast}ms ${theme.motion.easing}`,
                ...style,
            });
            c.addEventListener('mouseenter', () => {
                c.style.background = 'rgba(128,128,128,.15)';
            });
            c.addEventListener('mouseleave', () => {
                c.style.background = 'rgba(128,128,128,.08)';
            });
            return c;
        };
        const folderCard = (f, seq) => {
            const c = card({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                height: '62px',
            });
            c.dataset.folder = f.rel;
            c.dataset.seq = String(seq);
            const g = el('span', { display: 'flex', flex: '0 0 auto' });
            g.innerHTML = ui.folderIcon(false, 26);
            const words = el('div', { minWidth: '0', flex: '1 1 auto' });
            const notes = f.count,
                folders = f.folders.length;
            const name = el(
                'div',
                {
                    font: '600 13.5px ' + theme.font,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                },
                f.name
            );
            name.dataset.name = '';
            words.append(
                name,
                el(
                    'div',
                    { font: '12px ' + theme.font, color: quiet, marginTop: '2px', whiteSpace: 'nowrap' },
                    [
                        notes ? `${notes} note${notes === 1 ? '' : 's'}` : '',
                        folders ? `${folders} folder${folders === 1 ? '' : 's'}` : '',
                    ]
                        .filter(Boolean)
                        .join(' · ') || 'Empty'
                )
            );
            c.append(g, words);
            return c;
        };
        const clamp = (lines) => ({
            display: '-webkit-box',
            WebkitLineClamp: String(lines),
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
        });
        const noteCard = (n, { where = false, seq = relocSeq } = {}) => {
            const c = card({
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px 14px',
                height: '156px',
            });
            c.dataset.rel = n.rel;
            c.dataset.seq = String(seq);
            const title = el(
                'div',
                { font: '700 13.5px ' + theme.font, lineHeight: '1.3', ...clamp(2) },
                n.name || 'Untitled'
            );
            // data-name marks the label a drag carries and an inline rename types over.
            title.dataset.name = '';
            c.append(
                title,
                el(
                    'div',
                    { font: '12.5px ' + theme.font, lineHeight: '1.45', color: quiet, flex: '1 1 auto', ...clamp(4) },
                    (hits ? n.snippet : n.preview) || 'No additional text'
                ),
                el(
                    'div',
                    {
                        font: '11.5px ' + theme.font,
                        color: quiet,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    },
                    [
                        shortDate(sortKey() === 'created' ? n.birth || n.mtime : n.mtime),
                        where && parentOf(n.rel) ? parentOf(n.rel) : '',
                    ]
                        .filter(Boolean)
                        .join(' · ')
                )
            );
            return c;
        };
        // whenFree: a card being renamed keeps its field until the name is in.
        const renderGallery = () => ui.whenFree(galleryBody, drawGallery);
        const drawGallery = () => {
            if (here.kind !== 'folder') return;
            const scroll = galleryBody.scrollTop;
            galleryBody.textContent = '';
            if (query) {
                const list = hits || [];
                galleryBody.appendChild(
                    groupHead(hits ? `${list.length}${searchPartial ? '+' : ''} found` : 'Searching…')
                );
                const g = grid();
                for (const n of list) g.appendChild(noteCard(n, { where: true, seq: n.seq }));
                galleryBody.appendChild(g);
                if (hits && !list.length)
                    galleryBody.appendChild(el('div', { padding: '24px 4px', color: quiet }, 'No notes match'));
                if (searchPartial)
                    galleryBody.appendChild(
                        el(
                            'div',
                            { padding: '14px 4px', color: quiet, font: '12px ' + theme.font },
                            'Only some of the matches are shown. Add a word to narrow it down.'
                        )
                    );
            } else {
                const node = nodeAt(here.rel);
                // Until this folder's list arrives, another folder's notes are never drawn under its name.
                const mine = cards.rel === here.rel ? cards : null;
                if (!node || !mine) {
                    galleryBody.appendChild(el('div', { padding: '24px 4px', color: quiet }, 'Loading\u2026'));
                    galleryBody.scrollTop = scroll;
                    return;
                }
                if (node.folders.length) {
                    galleryBody.appendChild(groupHead('Folders'));
                    const g = grid();
                    for (const f of node.folders) g.appendChild(folderCard(f, tree.seq));
                    galleryBody.appendChild(g);
                }
                if (mine.notes.length) {
                    galleryBody.appendChild(groupHead('Notes'));
                    const g = grid();
                    for (const n of sorted(mine.notes)) g.appendChild(noteCard(n, { seq: mine.seq }));
                    galleryBody.appendChild(g);
                }
                if (!node.folders.length && !mine.notes.length) {
                    const empty = ui.emptyState({
                        icon: glyph('notes', 44),
                        title: here.rel ? 'This folder is empty' : 'No notes yet',
                        hint: here.rel ? '' : 'A note is a Markdown file, and a folder here is a folder on disk.',
                        actions: [
                            keyed(
                                ui.textBtn('New Note', 'New note', () => newNote(), {
                                    size: 'sm',
                                    icon: glyph('compose', 14),
                                }),
                                'New note',
                                'newNote'
                            ),
                            keyed(
                                ui.textBtn('New Folder', 'New folder', () => newFolder(currentFolder()), {
                                    size: 'sm',
                                    icon: glyph('folderPlus', 14),
                                }),
                                'New folder',
                                'newFolder'
                            ),
                        ],
                    });
                    // Absolute, so the gallery's padding cannot push it into a scroll.
                    Object.assign(empty.style, { position: 'absolute', inset: '0' });
                    galleryBody.appendChild(empty);
                }
            }
            galleryBody.scrollTop = scroll;
        };
        // Delegated, so a redraw never loses a press.
        const cardAt = (e) => e.target.closest?.('[data-rel], [data-folder]');
        galleryBody.addEventListener('click', (e) => {
            const c = cardAt(e);
            if (!c) return;
            if (c.dataset.rel) openAt(c.dataset.rel);
            else showFolder(c.dataset.folder);
        });
        ui.contextMenu(galleryBody, {
            rowAt: (t) => t.closest?.('[data-rel], [data-folder]') || null,
            items: (c) =>
                c?.dataset.rel
                    ? noteItems(c.dataset.rel, Number(c.dataset.seq))
                    : c
                      ? folderItems(c.dataset.folder, Number(c.dataset.seq), c)
                      : folderItems(currentFolder()),
        });
        ui.dragSource(galleryBody, { itemAt: (t) => t.closest?.('[data-rel], [data-folder]') || null, what: pickUp });
        dropZone(galleryBody, (at) => {
            const c = at.closest?.('[data-folder]');
            return c
                ? { folder: c.dataset.folder, mark: c, seq: Number(c.dataset.seq) }
                : { folder: here.rel, mark: galleryBody };
        });

        const paintPlace = () => {
            const onNote = here.kind === 'note';
            galleryPane.style.display = onNote ? 'none' : 'flex';
            notePane.style.display = onNote ? 'flex' : 'none';
            if (onNote) noteNav.paint(parentOf(here.rel), { leaf: false });
            else {
                galleryNav.paint(here.rel);
                renderGallery();
            }
            renderTree();
        };
        /* `enter` answers "ok", "blocked" (unsaved typing or a question is up: stay, keep the history)
       or "gone". Moves run one at a time, so two Backs pressed together are two steps in order. */
        let moving = Promise.resolve();
        const serial = (step) => (moving = moving.catch(() => {}).then(step));
        const enter = async (to, { focus = false, quiet = false } = {}) => {
            if (to.kind === 'note') return openNote(to.rel, { focus, quiet });
            if (!nodeAt(to.rel)) return 'gone';
            if (note.rel) {
                const r = await openNote(null);
                if (r !== 'ok') return r;
            }
            return 'ok';
        };
        const land = (to) => {
            const folderChanged = to.kind === 'folder' && !same(here, to);
            here = to;
            persistHere();
            reveal(to.rel);
            if (to.kind === 'folder') {
                if (query) {
                    search.setValue('');
                    query = '';
                    hits = null;
                }
                if (folderChanged) galleryBody.scrollTop = 0;
            }
            paintPlace();
            if (to.kind === 'folder') loadGallery();
        };
        const go = (to, { record = true, focus = false } = {}) =>
            serial(async () => {
                const r = await enter(to, { focus });
                if (r !== 'ok') return r;
                if (record && !same(here, to)) {
                    back.push(here);
                    ahead.length = 0;
                    if (back.length > 50) back.shift();
                }
                land(to);
                return r;
            });
        const showFolder = async (rel, options) => (await go({ kind: 'folder', rel }, options)) === 'ok';
        const openAt = async (rel, options) => (await go({ kind: 'note', rel }, options)) === 'ok';
        const step = (from, to) =>
            serial(async () => {
                while (from.length) {
                    const there = from[from.length - 1];
                    const r = await enter(there, { quiet: true });
                    if (r === 'blocked') return r;
                    from.pop();
                    if (r === 'gone') continue;
                    to.push(here);
                    land(there);
                    return r;
                }
                return 'gone';
            });
        const goBack = () => step(back, ahead);
        const goAhead = () => step(ahead, back);
        const leaveNote = async () => {
            const rel = note.rel || (here.kind === 'note' ? here.rel : '');
            closeNote();
            let folder = parentOf(rel);
            while (folder && !nodeAt(folder)) folder = parentOf(folder);
            await showFolder(folder, { record: false });
        };

        const loadTree = async () => {
            const seq = relocSeq;
            try {
                tree = await main.call('tree');
            } catch {
                return;
            }
            tree.seq = seq;
            if (here.kind === 'folder' && !nodeAt(here.rel)) {
                let up = parentOf(here.rel);
                while (up && !nodeAt(up)) up = parentOf(up);
                // Queued, not awaited: a refresh can run inside a move already under way.
                go({ kind: 'folder', rel: up }, { record: false });
                return;
            }
            paintPlace();
        };
        let gallerySeq = 0;
        const loadGallery = async () => {
            if (here.kind !== 'folder') return;
            const mine = ++gallerySeq,
                want = here.rel,
                seq = relocSeq;
            let got = [];
            try {
                got = await main.call('list', want);
            } catch {}
            if (mine !== gallerySeq || here.kind !== 'folder' || here.rel !== want) return;
            cards = { rel: want, notes: got, seq };
            renderGallery();
        };
        const runSearch = (raw) => {
            query = String(raw || '').trim();
            const mine = ++searchSeq;
            if (!query) {
                hits = null;
                searchPartial = false;
                renderGallery();
                return;
            }
            hits = null;
            renderGallery();
            setTimeout(async () => {
                if (mine !== searchSeq) return;
                let got = { hits: [], partial: false };
                const seq = relocSeq;
                try {
                    got = await main.call('search', query);
                } catch {}
                if (mine !== searchSeq) return;
                hits = got.hits.map((n) => ({ ...n, seq }));
                searchPartial = got.partial;
                renderGallery();
            }, 150);
        };
        const refresh = () => Promise.all([loadTree(), loadGallery(), query ? (runSearch(query), null) : null]);

        /* On screen is the disk version (`base`, its modification time) plus unsaved typing (`dirty`),
       unless a question about the disk is up (`trouble`): then nothing is written or typed until it
       is answered. Every disk step on the open note goes through `queued`, so a rename or a move
       never lands between a save's write and its answer. `token` changes with every note opened, so
       an answer for the previous note is dropped. `fresh`: made a moment ago, text and name untouched.
       `titleEdited`: a name typed in the title field and not yet given to the file. */
        const note = {
            rel: null,
            base: null,
            dirty: false,
            trouble: null,
            fresh: false,
            titleEdited: false,
            bom: false,
            eol: '\n',
            token: 0,
        };
        /* A rename in flight, which every gate awaits: a menu opened just after the title field lost
       focus holds the old name. Meanwhile the title field shows the new name. */
        let renaming = null;
        const blank = () => note.fresh && !!note.rel && !editor.text();
        let chain = Promise.resolve();
        const queued = (step) => (chain = chain.catch(() => {}).then(step));

        /* `says`: main's message follows the words. `settles`: the question goes by itself once the disk
       matches the screen. `outlived`: gives way to CHANGED when another version turns up. `fromCopy`:
       about the backup on disk, so a later read can repeat or end it. Any other kind is FAILED. */
        const TROUBLE = {
            CHANGED: {
                settles: true,
                words: 'This note was changed outside the panel while you were editing it.',
                answers: [
                    ['Use Theirs', 'Load the version on disk; your edits since are dropped', () => reload()],
                    ['Keep Mine', 'Write what is on screen over the version on disk', () => save({ force: true })],
                ],
            },
            GONE: {
                settles: true,
                outlived: true,
                words: 'This note was moved or deleted outside the panel.',
                answers: [
                    ['Save It Again', 'Write what is on screen back to where it was', () => save({ force: true })],
                    ['Close', 'Close the note; anything typed since the last save is dropped', () => leaveNote()],
                ],
            },
            UNREADABLE: {
                settles: true,
                outlived: true,
                says: true,
                words: 'This note can no longer be read as text',
                answers: [
                    ['Close', 'Close the note; anything typed since the last save is dropped', () => leaveNote()],
                ],
            },
            TORN: {
                settles: true,
                says: true,
                fromCopy: true,
                words: 'A save of this note stopped partway, so the note on disk may be cut short. The version before that save is kept',
                answers: () => [
                    ...(note.dirty
                        ? [
                              [
                                  "Save What's on Screen",
                                  'Write what is on screen to the note; the kept version goes once it is down',
                                  () => save({ force: true }),
                              ],
                          ]
                        : []),
                    [
                        'Restore Kept Version',
                        'Put the version from before that save back as the note',
                        () => restoreKept(),
                    ],
                    note.dirty
                        ? [
                              'Close Without Saving',
                              'Leave the note as it is on disk, with its kept version; what was typed here is dropped',
                              () => leaveNote(),
                          ]
                        : [
                              'Close',
                              'Leave the note and its kept version as they are; it asks again when opened',
                              () => leaveNote(),
                          ],
                ],
            },
            FAILED: {
                says: true,
                words: 'Could not save this note',
                answers: [
                    [
                        'Try Again',
                        'Save it again, the same way as the save that failed',
                        () => {
                            const force = !!note.trouble?.force;
                            setTrouble(null);
                            save({ force });
                        },
                    ],
                    [
                        'Close Without Saving',
                        'Close the note; what was typed since the last save is dropped',
                        () => leaveNote(),
                    ],
                ],
            },
        };
        const troubleOf = (kind, e) => {
            const k = TROUBLE[kind] ? kind : 'FAILED';
            return { kind: k, message: TROUBLE[k].says && e ? said(e) : '' };
        };
        const readTrouble = (e) => troubleOf(kindOf(e) === 'GONE' ? 'GONE' : 'UNREADABLE', e);
        const setTrouble = (t) => {
            note.trouble = t;
            editor.setReadOnly(!!t);
            paintNote();
        };
        const paintNote = () => {
            const has = !!note.rel;
            moreBtn.setEnabled(has);
            if (has && !note.titleEdited && !renaming && titleInput.value !== noteName(note.rel))
                titleInput.value = noteName(note.rel);
            titleInput.disabled = !has || !!note.trouble;
            stamp.textContent = has && note.base ? 'Edited ' + longDate(note.base) : '';
            banner.textContent = '';
            const t = note.trouble && TROUBLE[note.trouble.kind];
            banner.style.display = t ? 'flex' : 'none';
            if (!t) return;
            banner.appendChild(
                el('span', { flex: '1 1 auto' }, t.words + (note.trouble.message ? ': ' + note.trouble.message : ''))
            );
            for (const [label, title, run] of typeof t.answers === 'function' ? t.answers() : t.answers)
                banner.appendChild(ui.textBtn(label, title, run, { size: 'sm' }));
        };
        const nudge = () => {
            if (theme.motion.fast)
                banner.animate(
                    [
                        { transform: 'translateX(0)' },
                        { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' },
                        { transform: 'translateX(0)' },
                    ],
                    { duration: 240, easing: theme.motion.easing }
                );
        };

        let saveTimer = 0;
        const scheduleSave = () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => save(), 500);
        };
        const edited = () => {
            note.dirty = true;
            note.fresh = false;
            scheduleSave();
        };
        // Resolves whether the note is in step with the disk. `force` writes without the check against base.
        const save = ({ force = false } = {}) => {
            clearTimeout(saveTimer);
            saveTimer = 0;
            return queued(async () => {
                if (!note.rel) return true;
                if (note.trouble && !force) return false;
                if (!note.dirty && !force) return true;
                const { rel, token } = note,
                    text = editor.text();
                try {
                    const got = await main.call('write', rel, text, force ? null : note.base, {
                        bom: note.bom,
                        eol: note.eol,
                    });
                    if (token !== note.token) return true;
                    note.base = got.mtime;
                    // Typed while the write was in flight: still unsaved.
                    note.dirty = editor.text() !== text;
                    if (note.trouble) setTrouble(null);
                    else paintNote();
                    if (note.dirty) scheduleSave();
                    return !note.dirty;
                } catch (e) {
                    if (token !== note.token) return false;
                    const kind = kindOf(e);
                    setTrouble({ ...troubleOf(kind, e), force });
                    return false;
                }
            });
        };
        const reload = () =>
            queued(async () => {
                const { rel, token } = note;
                if (!rel) return;
                try {
                    const got = await main.call('read', rel);
                    if (token !== note.token) return;
                    show(got);
                    note.dirty = false;
                    setTrouble(null);
                } catch (e) {
                    if (token === note.token) setTrouble(readTrouble(e));
                }
            });
        const show = (got) => {
            editor.replace(got.text);
            Object.assign(note, { base: got.mtime, bom: got.bom, eol: got.eol });
        };
        const reconcile = () =>
            queued(async () => {
                const { rel, token } = note;
                if (!rel) return;
                let got;
                try {
                    got = await main.call('read', rel);
                } catch (e) {
                    if (token === note.token) setTrouble(readTrouble(e));
                    return;
                }
                if (token !== note.token) return;
                // Torn by a save here or in an earlier session.
                if (got.torn) {
                    if (!TROUBLE[note.trouble?.kind]?.fromCopy) setTrouble(troubleOf('TORN'));
                    return;
                }
                // The disk matches the screen (saved elsewhere the same, restored, checked out again).
                if (got.text === editor.text()) {
                    Object.assign(note, { base: got.mtime, bom: got.bom, eol: got.eol, dirty: false });
                    if (note.trouble && TROUBLE[note.trouble.kind]?.settles) setTrouble(null);
                    else paintNote();
                    return;
                }
                if (!note.trouble && Math.abs(got.mtime - note.base) <= 1) return;
                // Nothing unsaved: the disk version comes in, which also ends a question about the backup.
                if (!note.dirty && (!note.trouble || TROUBLE[note.trouble.kind]?.fromCopy)) {
                    show(got);
                    if (note.trouble) setTrouble(null);
                    return paintNote();
                }
                // Another version is there: a change, whatever the question was (gone and back again is not gone).
                if (!note.trouble || TROUBLE[note.trouble.kind]?.outlived) setTrouble(troubleOf('CHANGED'));
            });
        const restoreKept = async () => {
            const { rel } = note;
            if (!rel) return;
            try {
                await queued(() => main.call('restore', rel));
            } catch (e) {
                ui.dialog({ title: 'Could not restore ' + noteName(rel), message: said(e), confirmLabel: 'OK' });
                return;
            }
            note.dirty = false;
            setTrouble(null);
            reload();
        };

        /* The gate before anything leaves, moves, renames or removes the open note (or a folder holding
       it, with `rel`). False, with the question nudged, while anything typed is not on disk. A
       question with nothing unsaved behind it (a torn note only looked at) holds no one. */
        const settle = async (rel = null) => {
            if (renaming) await renaming;
            if (!note.rel || (rel != null && !within(note.rel, rel))) return true;
            if (note.titleEdited && !(await renameNote())) return false;
            for (let i = 0; i < 3 && note.dirty && !note.trouble; i++) await save();
            if (note.dirty) {
                nudge();
                return false;
            }
            await queued(() => {});
            return true;
        };
        // Called only once the switch is certain, so a failed switch keeps the note.
        const discardFresh = (left) => {
            if (left) main.call('discard', left).catch(() => {});
        };
        // "blocked" also covers another opening that overtook this one.
        let opening = 0;
        const openNote = async (rel, { focus = false, quiet = false } = {}) => {
            if (rel && rel === note.rel) {
                if (focus) editor.focus({ end: true });
                return 'ok';
            }
            const mine = ++opening;
            if (!(await settle())) return 'blocked';
            if (mine !== opening) return 'blocked';
            const left = blank() ? note.rel : null;
            if (!rel) {
                closeNote();
                discardFresh(left);
                return 'ok';
            }
            let got;
            try {
                got = await main.call('read', rel);
            } catch (e) {
                if (!quiet)
                    ui.dialog({ title: 'Could not open ' + noteName(rel), message: said(e), confirmLabel: 'OK' });
                return 'gone';
            }
            if (mine !== opening) return 'blocked';
            Object.assign(note, {
                rel,
                base: got.mtime,
                dirty: false,
                trouble: null,
                fresh: false,
                titleEdited: false,
                bom: got.bom,
                eol: got.eol,
                token: note.token + 1,
            });
            titleError.textContent = '';
            try {
                editor.open({ text: got.text });
            } finally {
                editor.setReadOnly(false);
                paintNote();
            }
            discardFresh(left);
            if (got.torn) setTrouble(troubleOf('TORN'));
            if (focus) editor.focus({ end: true });
            return 'ok';
        };
        // Drops unsaved typing: the caller has saved or chosen not to.
        const closeNote = () => {
            clearTimeout(saveTimer);
            Object.assign(note, {
                rel: null,
                base: null,
                dirty: false,
                trouble: null,
                fresh: false,
                titleEdited: false,
                token: note.token + 1,
            });
            editor.close();
            paintNote();
        };

        /* Called inside the queue right after a move, so no save is in flight to the old place.
       A path read at relocSeq N (a row, a card, a menu, a drag; their data-seq) is brought up to
       date by the relocations after N (currentPath). */
        const relocations = [];
        let relocSeq = 0;
        /* `to` null: the path went to the Trash. The open note and `here` are left by the caller
       (leaveNote), which knows where to go instead. */
        const relocate = (from, to) => {
            relocations.push({ from, to, seq: ++relocSeq });
            if (relocations.length > 100) relocations.shift();
            const move = (p) => util.movePath(p, from, to);
            if (to == null)
                for (const list of [back, ahead])
                    for (let i = list.length - 1; i >= 0; i--) {
                        if (move(list[i].rel) === null) list.splice(i, 1);
                    }
            else {
                if (note.rel) note.rel = move(note.rel);
                for (const place of [here, ...back, ...ahead]) place.rel = move(place.rel);
            }
            persistHere();
            expanded = new Set([...expanded].map(move).filter((x) => x != null));
            store.set('expanded', [...expanded]);
        };
        // Null if the path went to the Trash since.
        const currentPath = async (rel, since) => {
            if (renaming) await renaming;
            await queued(() => {});
            return relocations.reduce((p, r) => (r.seq > since ? util.movePath(p, r.from, r.to) : p), rel);
        };

        const newNote = async ({ into = currentFolder() } = {}) => {
            host.show();
            if (!(await settle())) return;
            // Making another would discard this blank one and take the next free name on every press.
            if (blank() && parentOf(note.rel) === into) {
                titleInput.focus();
                titleInput.select();
                return;
            }
            let made;
            try {
                made = await main.call('create', into);
            } catch (e) {
                ui.dialog({ title: 'Could not make a note', message: said(e), confirmLabel: 'OK' });
                return;
            }
            if (!(await openAt(made.rel))) return;
            note.fresh = true;
            await refresh();
            titleInput.focus();
            titleInput.select();
        };

        titleInput.addEventListener('input', () => {
            note.titleEdited = true;
            note.fresh = false;
        });
        // `titleEdited` is cleared before the rename starts, so settle() does not ask for the same rename again.
        const renameNote = () => {
            if (!note.rel || !note.titleEdited) return Promise.resolve(true);
            note.titleEdited = false;
            const done = renameNow();
            const tracked = done.finally(() => {
                if (renaming === tracked) {
                    renaming = null;
                    paintNote();
                }
            });
            renaming = tracked;
            return done;
        };
        const renameNow = async () => {
            const from = note.rel;
            const want = titleInput.value.trim();
            if (!want || want === noteName(from)) {
                titleInput.value = noteName(from);
                titleError.textContent = '';
                return true;
            }
            if (!(await settle(from))) {
                titleInput.value = noteName(note.rel || from);
                return false;
            }
            let ok = false;
            await queued(async () => {
                try {
                    relocate(from, (await main.call('rename', from, want)).rel);
                    titleError.textContent = '';
                    ok = true;
                } catch (e) {
                    if (note.rel === from) {
                        titleError.textContent = said(e);
                        titleInput.value = noteName(from);
                    }
                }
            });
            await refresh();
            paintPlace();
            return ok;
        };
        titleInput.addEventListener('keydown', (e) => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                renameNote().then(() => editor.focus({ end: e.key === 'Enter' }));
            } else if (e.key === 'Escape') {
                e.preventDefault();
                note.titleEdited = false;
                titleInput.value = noteName(note.rel || '');
                titleError.textContent = '';
                editor.focus();
            }
        });
        titleInput.addEventListener('blur', () => {
            renameNote();
        });

        const trashNote = async (held, since = relocSeq) => {
            const rel = await currentPath(held, since);
            if (rel == null) return;
            const open = !!note.rel && within(note.rel, rel);
            // Saved first, so what goes to the Trash is what was on screen.
            if (!(await settle(rel))) return;
            try {
                await queued(() => main.call('trash', rel));
            } catch (e) {
                ui.dialog({
                    title: 'Could not move ' + noteName(rel) + ' to the Trash',
                    message: said(e),
                    confirmLabel: 'OK',
                });
                return;
            }
            relocate(rel, null);
            if (open) await leaveNote();
            await refresh();
        };
        const moveTo = async (held, heldInto, since = relocSeq, intoSince = since) => {
            const rel = await currentPath(held, since);
            const into = await currentPath(heldInto, intoSince);
            if (rel == null || into == null) return;
            // Checked again: something may have moved since it was picked up.
            if (!ui.movesInto(rel, into)) return;
            if (!(await settle(rel))) return;
            await queued(async () => {
                try {
                    relocate(rel, (await main.call('move', rel, into)).rel);
                } catch (e) {
                    ui.dialog({ title: 'Could not move ' + baseName(rel), message: said(e), confirmLabel: 'OK' });
                }
            });
            await refresh();
            paintNote();
            paintPlace();
        };
        const openLinked = async (target) => {
            const parts = parentOf(note.rel || '') ? parentOf(note.rel).split('/') : [];
            for (const p of target.split('/')) {
                if (p === '..') parts.pop();
                else if (p && p !== '.') parts.push(p);
            }
            const rel = parts.join('/');
            openAt(rel, { focus: true });
        };

        const KIND_KEY = {
            title: 'title',
            heading: 'heading',
            subheading: 'subheading',
            body: 'body',
            mono: 'monospaced',
            bullet: 'bulletedList',
            number: 'numberedList',
            check: 'checklist',
            quote: 'blockQuote',
        };
        const styleItems = () => {
            const now = editor.styleAt();
            return NOTE_KINDS.map((k) =>
                k === '-'
                    ? '-'
                    : {
                          label: k.label,
                          hint: host.chordOf(KIND_KEY[k.key]),
                          checked: now === k.key,
                          run: () => editor.format(k.key),
                      }
            );
        };

        const moveItems = (rel, since) => {
            const listed = tree.seq ?? relocSeq;
            return [
                { label: 'All Notes', checked: parentOf(rel) === '', run: () => moveTo(rel, '', since, listed) },
                ...folderList()
                    .filter((f) => !within(f.rel, rel))
                    .map((f) => ({
                        label: ' '.repeat(f.depth + 1) + f.name,
                        checked: parentOf(rel) === f.rel,
                        run: () => moveTo(rel, f.rel, since, listed),
                    })),
            ];
        };
        const onNow = (rel, since, act) => async () => {
            const now = await currentPath(rel, since);
            if (now != null) act(now);
        };
        let rootAsked = null;
        const showInFinder = async (rel) => {
            rootAsked =
                rootAsked ||
                main
                    .call('root')
                    .then((r) => r.root)
                    .catch(() => null);
            const root = await rootAsked;
            if (root) host.reveal(rel ? root + '/' + rel : root);
        };
        const copyText = async (rel) => {
            const text = rel === note.rel ? editor.text() : (await main.call('read', rel).catch(() => null))?.text;
            if (text != null) host.clipboard.writeText(text).catch(() => {});
        };
        const noteItems = (rel, since = relocSeq, row = null) => [
            {
                label: 'Rename…',
                icon: 'pencil',
                run: async () => {
                    const label = row?.isConnected && row.querySelector('[data-name]');
                    if (label) return renameAt(label, rel, since);
                    const now = await currentPath(rel, since);
                    if (now == null || (now !== note.rel && !(await openAt(now)))) return;
                    titleInput.focus();
                    titleInput.select();
                },
            },
            { label: 'Move to', icon: 'folder', items: moveItems(rel, since) },
            '-',
            { label: 'Copy as Markdown', icon: 'copy', run: onNow(rel, since, copyText) },
            { label: 'Show in Finder', icon: 'folder', run: onNow(rel, since, showInFinder) },
            '-',
            {
                label: 'Move to Trash',
                icon: glyph('trash', 14),
                hint: host.chordOf('trash'),
                run: () => trashNote(rel, since),
            },
        ];

        const pageMenu = (e, href) => {
            const items = [];
            if (href) {
                items.push(
                    {
                        label: 'Open Link',
                        icon: 'externalWindow',
                        disabled: noteLinkTarget(href).kind === 'none',
                        run: () => {
                            const t = noteLinkTarget(href);
                            if (t.kind === 'address') noteOpenAddress({ host, ui }, t.href);
                            else if (t.kind === 'note') openLinked(t.path);
                        },
                    },
                    { label: 'Copy Link', icon: 'link', run: () => host.clipboard.writeText(href).catch(() => {}) },
                    { label: 'Edit Link…', hint: '⌘K', run: () => editor.editLink() },
                    '-'
                );
            }
            if (editor.selectionText())
                items.push(
                    {
                        label: 'Copy',
                        hint: '⌘C',
                        run: () => host.clipboard.writeText(editor.selectionText()).catch(() => {}),
                    },
                    '-'
                );
            items.push(...styleItems());
            ui.menu(items, { at: { x: e.clientX, y: e.clientY } });
        };

        const sidebar = el('div', { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' });
        const section = ui.section('All Notes', {
            icon: glyph('notes', 16),
            actions: [
                { icon: glyph('compose', 16), title: 'New note', run: () => newNote() },
                { icon: glyph('folderPlus', 16), title: 'New folder', run: () => newFolder(currentFolder()) },
            ],
            onHeading: () => {
                host.show();
                showFolder('');
            },
            onHeadingMenu: (e) => ui.menu(folderItems(''), { at: { x: e.clientX, y: e.clientY } }),
        });
        keyed(section.actions[0], 'New note', 'newNote');
        keyed(section.actions[1], 'New folder', 'newFolder');
        const sectionHeading = section.heading;
        const treeEl = ui.list();
        section.body.appendChild(treeEl);
        sidebar.appendChild(section);

        const toggle = (rel) => {
            if (expanded.has(rel)) expanded.delete(rel);
            else expanded.add(rel);
            store.set('expanded', [...expanded]);
            renderTree();
        };
        const foldable = (rel) => {
            const n = nodeAt(rel);
            return !!rel && !!n && n.folders.length + n.notes.length > 0;
        };
        const noteRow = ({ kind, rel, name, depth, open = false, folds = false }) => {
            const page = `<span style="display:flex;color:${quiet}">${glyph('fileText', 16)}</span>`;
            const r = ui.treeRow({
                depth,
                folder: kind === 'folder',
                folds,
                open,
                glyph: page,
                name: name || 'Untitled',
            });
            if (kind === 'note') r.dataset.rel = rel;
            else r.dataset.folder = rel;
            r.title = rel;
            r.dataset.seq = String(tree.seq ?? 0);
            const on =
                kind === 'note' ? here.kind === 'note' && note.rel === rel : here.kind === 'folder' && here.rel === rel;
            return ui.hoverable(r, () => on);
        };
        /* Redrawn only when something shown changed: a save comes back as a tree refresh, and rebuilding
       rows under a pointer pressing one would lose the press. Row events are delegated for the same reason. */
        let drawn = '';
        // whenFree: a row being renamed keeps its field until the name is in.
        const renderTree = () => ui.whenFree(treeEl, drawTree);
        const drawTree = () => {
            const key = JSON.stringify([tree, here, note.rel, [...expanded].sort()]);
            if (key === drawn) return;
            drawn = key;
            treeEl.textContent = '';
            section.setCurrent(here.kind === 'folder' && here.rel === '');
            const walk = (node, depth) => {
                for (const f of node.folders) {
                    const open = expanded.has(f.rel);
                    treeEl.appendChild(
                        noteRow({
                            kind: 'folder',
                            rel: f.rel,
                            name: f.name,
                            depth,
                            open,
                            folds: f.folders.length + f.notes.length > 0,
                        })
                    );
                    if (open) walk(f, depth + 1);
                }
                for (const n of node.notes)
                    treeEl.appendChild(noteRow({ kind: 'note', rel: n.rel, name: n.name, depth }));
            };
            walk(tree, 0);
        };
        const rowAt = (e) => e.target.closest?.('[data-rel], [data-folder]');
        treeEl.addEventListener('click', (e) => {
            const r = rowAt(e);
            if (!r) return;
            host.show();
            if (r.dataset.rel) {
                openAt(r.dataset.rel);
                return;
            }
            const rel = r.dataset.folder;
            if (foldable(rel)) toggle(rel);
            if (!e.target.closest('[data-caret]')) showFolder(rel);
        });
        ui.contextMenu(treeEl, {
            rowAt: (t) => t.closest?.('[data-rel], [data-folder]') || null,
            items: (r) =>
                !r
                    ? null
                    : r.dataset.rel
                      ? noteItems(r.dataset.rel, Number(r.dataset.seq), r)
                      : folderItems(r.dataset.folder, Number(r.dataset.seq), r),
        });
        ui.dragSource(treeEl, { itemAt: (t) => t.closest?.('[data-rel], [data-folder]') || null, what: pickUp });
        dropZone(
            sidebar,
            ui.treeFolderAt({
                row: (at) => {
                    const r = at.closest?.('[data-rel], [data-folder]');
                    return r ? { path: r.dataset.rel || r.dataset.folder, folder: !r.dataset.rel, el: r } : null;
                },
                markOf: (folder) => treeEl.querySelector(`[data-folder="${CSS.escape(folder)}"]`),
                top: '',
                topMark: sectionHeading,
            })
        );

        const folderItems = (rel, since = relocSeq, place = null) => [
            {
                label: 'New Note',
                icon: glyph('compose', 14),
                hint: host.chordOf('newNote'),
                run: onNow(rel, since, (into) => newNote({ into })),
            },
            {
                label: 'New Folder',
                icon: glyph('folderPlus', 14),
                hint: host.chordOf('newFolder'),
                run: onNow(rel, since, newFolder),
            },
            ...(rel
                ? [
                      '-',
                      {
                          label: 'Rename…',
                          icon: 'pencil',
                          run: async () => {
                              const now = await currentPath(rel, since);
                              const label =
                                  now != null &&
                                  ((place?.isConnected && place.querySelector('[data-name]')) || (await nameAt(now)));
                              if (label) renameAt(label, rel, since);
                          },
                      },
                      { label: 'Move to', icon: 'folder', items: moveItems(rel, since) },
                  ]
                : []),
            '-',
            { label: 'Show in Finder', icon: 'folder', run: onNow(rel, since, showInFinder) },
            ...(rel
                ? [
                      {
                          label: 'Move to Trash',
                          icon: glyph('trash', 14),
                          hint: host.chordOf('trash'),
                          run: () => trashFolder(rel, since),
                      },
                  ]
                : []),
        ];
        const renameAt = (label, held, since = relocSeq) =>
            ui.inlineEdit(label, {
                commit: async (name) => {
                    const rel = await currentPath(held, since);
                    if (rel == null) return 'It is no longer there';
                    if (!(await settle(rel))) return 'The open note has a question to answer first';
                    let why = '';
                    await queued(async () => {
                        try {
                            relocate(rel, (await main.call('rename', rel, name)).rel);
                        } catch (e) {
                            why = said(e);
                        }
                    });
                    await refresh();
                    paintNote();
                    return why;
                },
            });
        // With neither the row nor the card visible (the sidebar folded away), the parent's gallery is shown.
        const nameAt = async (rel) => {
            const sel = `[data-rel="${CSS.escape(rel)}"] [data-name], [data-folder="${CSS.escape(rel)}"] [data-name]`;
            const seen = (n) => !!n?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            reveal(rel);
            renderTree();
            const shown = [treeEl.querySelector(sel), galleryBody.querySelector(sel)].find(seen);
            if (shown) return shown;
            if (!(await showFolder(parentOf(rel)))) return null;
            await loadGallery();
            return [galleryBody.querySelector(sel)].find(seen) || null;
        };
        const newFolder = async (parent) => {
            let made;
            try {
                made = await main.call('mkdir', parent, '');
                await loadTree();
            } catch (e) {
                ui.dialog({ title: 'Could not make the folder', message: said(e), confirmLabel: 'OK' });
                return;
            }
            const label = await nameAt(made.rel);
            if (label) renameAt(label, made.rel);
        };
        const trashFolder = (held, since = relocSeq) =>
            ui.dialog({
                title: `Move “${baseName(held)}” to the Trash?`,
                destructive: true,
                confirmLabel: 'Move to Trash',
                message: 'The folder and every note in it go to the macOS Trash, from where Finder can put them back.',
                onConfirm: async () => {
                    const rel = await currentPath(held, since);
                    if (rel == null) return;
                    const open = !!note.rel && within(note.rel, rel);
                    if (!(await settle(rel))) return;
                    try {
                        await queued(() => main.call('trash', rel));
                    } catch (e) {
                        ui.dialog({
                            title: 'Could not move the folder to the Trash',
                            message: said(e),
                            confirmLabel: 'OK',
                        });
                        return;
                    }
                    relocate(rel, null);
                    if (open) await leaveNote();
                    else if (here.kind === 'folder' && within(here.rel, rel))
                        await showFolder(parentOf(rel), { record: false });
                    await refresh();
                },
            });

        let changeTimer = 0;
        main.on('changed', (paths) => {
            clearTimeout(changeTimer);
            changeTimer = setTimeout(async () => {
                await refresh();
                if (note.rel && paths.some((p) => within(note.rel, p))) reconcile();
            }, 100);
        });
        let hadFocus = false;
        settings.on((key, value) => {
            if (key === 'sort') renderGallery();
            if (key === 'textSize' || key === 'font') applyType();
        });
        window.addEventListener('pagehide', () => {
            if (note.dirty) save();
        });

        // Nothing is drawn until the place is reached, so a note path never flashes up as a gallery.
        paintNote();
        (async () => {
            await main.call('root').catch(() => {});
            await loadTree();
            const was = here;
            if (was.kind === 'note' && (await openAt(was.rel, { record: false }))) return;
            let folder = was.kind === 'folder' ? was.rel : parentOf(was.rel);
            while (folder && !nodeAt(folder)) folder = parentOf(folder);
            await showFolder(folder, { record: false });
        })();

        const searchEntries = async (raw) => {
            const q = String(raw || '').trim();
            const recent = () => {
                const all = [];
                const walk = (n) => {
                    all.push(...n.notes);
                    n.folders.forEach(walk);
                };
                walk(tree);
                return all.sort((a, b) => b.mtime - a.mtime);
            };
            const got = q
                ? await main.call('search', q).catch(() => ({ hits: [], partial: false }))
                : { hits: recent(), partial: false };
            const shown = got.hits.slice(0, 50);
            // No run: a readout, not a place to go.
            const more =
                got.partial || got.hits.length > shown.length
                    ? [
                          {
                              label: 'Only some matches are shown',
                              hint: 'Add a word to narrow it down',
                              icon: ui.icon('search', 16),
                          },
                      ]
                    : [];
            return [
                ...shown.map((n) => ({
                    label: n.name || 'Untitled',
                    hint: [shortDate(n.mtime), parentOf(n.rel), (n.snippet || '').slice(0, 70)]
                        .filter(Boolean)
                        .join(' · '),
                    icon: glyph('fileText', 16),
                    run: () => {
                        host.show();
                        openAt(n.rel);
                    },
                })),
                ...more,
            ];
        };

        // Only while the note has the keyboard: elsewhere a text key would change a line nobody is looking at.
        const writing = (key) => () => {
            if (editor.hasFocus()) editor.format(key);
        };
        return {
            content,
            sidebar,
            didAppear: () => {
                main.call('watch', true).catch(() => {});
                refresh();
                reconcile();
                if (hadFocus && editor.isOpen() && here.kind === 'note') editor.focus();
                else if (here.kind === 'folder') galleryBody.focus();
            },
            didDisappear: () => {
                hadFocus = editor.hasFocus();
                if (note.dirty) save();
                main.call('watch', false).catch(() => {});
            },

            keys: {
                newNote: { key: 'mod+n', label: 'New note', run: () => newNote() },
                newFolder: { key: 'mod+shift+n', label: 'New folder', run: () => newFolder(currentFolder()) },
                // While a text field has focus, ⌘⌫ stays the field's (delete to line start).
                trash: {
                    key: 'mod+backspace',
                    label: 'Move to Trash',
                    run: () => {
                        if (here.kind === 'note') trashNote(here.rel);
                        else if (here.rel) trashFolder(here.rel);
                    },
                },
                search: {
                    key: 'mod+f',
                    label: 'Search notes',
                    run: async () => {
                        if (here.kind === 'note' && !(await showFolder(currentFolder()))) return;
                        search.input.focus();
                        search.input.select();
                    },
                },
                back: { key: 'mod+[', label: 'Back', run: () => goBack() },
                forward: { key: 'mod+]', label: 'Forward', run: () => goAhead() },
                title: { key: 'mod+shift+t', label: 'Title', run: writing('title') },
                heading: { key: 'mod+shift+h', label: 'Heading', run: writing('heading') },
                subheading: { key: 'mod+shift+j', label: 'Subheading', run: writing('subheading') },
                body: { key: 'mod+shift+b', label: 'Body', run: writing('body') },
                monospaced: { key: 'mod+shift+m', label: 'Monospaced', run: writing('mono') },
                bulletedList: { key: 'mod+shift+7', label: 'Bulleted list', run: writing('bullet') },
                numberedList: { key: 'mod+shift+9', label: 'Numbered list', run: writing('number') },
                checklist: { key: 'mod+shift+l', label: 'Checklist', run: writing('check') },
                markChecked: {
                    key: 'mod+shift+u',
                    label: 'Mark as checked',
                    run: () => {
                        if (editor.hasFocus()) editor.toggleChecked();
                    },
                },
                blockQuote: { key: "mod+'", label: 'Block quote', run: writing('quote') },
            },

            commands: () => [
                {
                    label: 'New Note',
                    icon: glyph('compose', 16),
                    keywords: ['새 노트', '새 메모', '노트', '메모', 'new', 'note', 'memo'],
                    run: () => newNote(),
                },
                {
                    label: 'Search Notes',
                    icon: ui.icon('search', 16),
                    keywords: ['노트 검색', '메모 검색', '노트', '메모', 'find', 'notes'],
                    page: { placeholder: 'Search notes', search: searchEntries },
                },
                ...folderList().map((f) => ({
                    group: 'Folders',
                    label: f.name,
                    hint: f.rel === f.name ? '' : parentOf(f.rel),
                    icon: ui.icon('folder', 16),
                    keywords: ['노트', '폴더', 'note', 'folder'],
                    run: () => {
                        host.show();
                        showFolder(f.rel);
                    },
                })),
            ],
        };
    },
});
