Deckit.register({
    order: -65,
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

    make({ theme, ui, store, data, host, main, settings, util }) {
        const el = (tag, style = {}, text) => {
            const e = document.createElement(tag);
            Object.assign(e.style, style);
            if (text != null) e.textContent = text;
            return e;
        };
        const nameOf = (p) => (p === '/' ? 'Macintosh HD' : p.split('/').pop() || p);
        const parentOf = (p) => (p === '/' ? null : p.slice(0, p.lastIndexOf('/')) || '/');
        let home = '';
        const tilde = (p) => (home && (p === home || p.startsWith(home + '/')) ? '~' + p.slice(home.length) : p);

        // All per-folder state lives on the tab in front; switching tabs only changes which tab is `current`.
        let current = null;
        const hereNow = () => (current ? current.here : null);
        // No entry means the folder is loading; an earlier answer stays shown while it is read again.
        const listings = new Map(); // dir -> { list, failure, v }
        const listingOf = (dir) => listings.get(dir) || null;
        const entries = () => listingOf(hereNow())?.list || [];
        const loading = () => !!hereNow() && !listings.has(hereNow());
        const entryOf = (p) => (p && listingOf(parentOf(p))?.list.find((e) => e.path === p)) || null;

        let view = store.get('view', 'columns') === 'list' ? 'list' : 'columns';
        const columnDirs = (t = current) => {
            if (!t?.here) return [];
            const dirs = [t.here];
            const sel = t.selected;
            const inside = sel && sel !== t.here && sel.startsWith(t.here === '/' ? '/' : t.here + '/');
            if (!inside) return dirs;
            const steps = sel.slice(t.here === '/' ? 1 : t.here.length + 1).split('/');
            let p = t.here;
            steps.forEach((name, i) => {
                p = p === '/' ? '/' + name : p + '/' + name;
                if (i < steps.length - 1 || entryOf(p)?.kind === 'folder') dirs.push(p);
            });
            return dirs;
        };
        const folderNow = () => (view === 'columns' ? columnDirs().at(-1) || null : hereNow());
        // The folder the keyboard walks: in columns the one holding the pick, in the list the tab's.
        const walkDir = () => {
            if (view !== 'columns') return hereNow();
            const sel = current?.selected;
            return sel && columnDirs().includes(parentOf(sel)) ? parentOf(sel) : hereNow();
        };
        let sort = store.get('sort', { key: 'name', up: true });
        let startFailure = null;

        let places = [];
        const favorites = () => {
            const saved = data.get('sidebar', null);
            return Array.isArray(saved) ? saved.filter((p) => typeof p === 'string') : places.map((p) => p.path);
        };
        // data.on only hears another window's writes, so this window redraws its own.
        const setFavorites = (list) => {
            data.set('sidebar', [...new Set(list)]);
            renderPlaces();
        };
        const placeOf = (p) => places.find((x) => x.path === p);
        const missingPlaces = () => places.filter((p) => !favorites().includes(p.path));

        const content = el('div', {
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            color: theme.contentColor,
            font: '13px ' + theme.font,
            overflow: 'hidden',
        });
        const head = el('div', {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flex: '0 0 auto',
            padding: '10px 12px 8px',
            minHeight: '30px',
        });
        const chordFor = (action) => () => host.chordOf(action);
        const backBtn = ui.tip(
            ui.iconBtn(ui.icon('chevronLeft', 16), 'Back', () => goBack(), { size: 'sm' }),
            'Back',
            chordFor('back')
        );
        const aheadBtn = ui.tip(
            ui.iconBtn(ui.icon('chevronRight', 16), 'Forward', () => goAhead(), { size: 'sm' }),
            'Forward',
            chordFor('forward')
        );
        const upBtn = ui.tip(
            ui.iconBtn(ui.icon('arrowUp', 15), 'Enclosing folder', () => goUp(), { size: 'sm' }),
            'Enclosing folder',
            chordFor('enclosing')
        );
        // In columns a crumb inside the tab's folder is picked, not gone to, so the columns stay.
        const crumbs = ui.breadcrumb({
            onGo: (p) => {
                const here = hereNow();
                if (view === 'columns' && here && p !== here && p.startsWith(here === '/' ? '/' : here + '/'))
                    select(p);
                else if (view === 'columns' && p === here) select(null);
                else go(p);
            },
        });
        crumbs.style.margin = '0 6px';
        const search = ui.field({
            placeholder: 'Filter this folder',
            size: 'sm',
            icon: ui.icon('search', 13),
            clearable: true,
            onInput: (v) => {
                const t = current;
                if (!t) return;
                if (!t.query) t.queryDir = walkDir();
                t.query = v.trim().toLowerCase();
                if (!t.query) t.queryDir = null;
                render();
            },
            onEnter: () => {
                const v = visibleIn(current?.queryDir || walkDir());
                if (v.length) {
                    select(v[0].path, { reveal: true });
                    listEl.focus();
                }
            },
            onEscape: () => {
                search.setValue('');
                if (current) {
                    current.query = '';
                    current.queryDir = null;
                }
                render();
                listEl.focus();
            },
        });
        Object.assign(search.style, { flex: '0 1 200px', minWidth: '120px' });
        const STAR = (on) => ui.icon('star', 15, { fill: on ? 'currentColor' : 'none' });
        const star = ui.iconBtn(
            STAR(false),
            'Add to Favorites',
            () => {
                const here = hereNow();
                if (!here) return;
                if (favorites().includes(here)) setFavorites(favorites().filter((p) => p !== here));
                else addFavorite(here);
                if (parseFloat(ui.motion.fast)) {
                    star.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], {
                        duration: 220,
                        easing: ui.motion.ease,
                    });
                }
            },
            { size: 'sm' }
        );
        const paintStar = () => {
            const on = !!hereNow() && favorites().includes(hereNow());
            star.setIcon(STAR(on));
            star.title = on ? 'Remove from Favorites' : 'Add to Favorites';
        };
        const VIEWS = [
            { key: 'columns', label: 'As Columns', icon: 'columns', action: 'columnView' },
            { key: 'list', label: 'As List', icon: 'list', action: 'listView' },
        ];
        const viewGlyph = () =>
            `<span style="display:flex;align-items:center;gap:1px">${ui.icon(VIEWS.find((v) => v.key === view).icon, 14)}${ui.icon('chevronDown', 10)}</span>`;
        const viewBar = ui.iconBtn(
            viewGlyph(),
            'View',
            () =>
                ui.menu(
                    VIEWS.map((v) => ({
                        label: v.label,
                        icon: v.icon,
                        hint: host.chordOf(v.action),
                        checked: v.key === view,
                        run: () => setView(v.key),
                    })),
                    { anchor: viewBar }
                ),
            { size: 'sm' }
        );
        Object.assign(viewBar.style, { width: 'auto', padding: '0 5px' });
        head.append(backBtn, aheadBtn, upBtn, crumbs, star, viewBar, search);

        const COLUMNS = [
            { key: 'name', label: 'Name' },
            { key: 'mtime', label: 'Date Modified', width: 150 },
            { key: 'size', label: 'Size', width: 76, right: true },
            { key: 'kind', label: 'Kind', width: 120 },
        ];
        let shown = COLUMNS;
        const template = () => shown.map((c) => (c.width ? c.width + 'px' : 'minmax(0, 1fr)')).join(' ');
        const columnsHead = el('div', {
            display: 'grid',
            alignItems: 'center',
            flex: '0 0 auto',
            height: '26px',
            margin: '0 12px',
            padding: '0 8px',
            borderBottom: theme.border,
            font: '600 11.5px ' + theme.font,
            color: ui.blend(theme.contentColor, theme.contentBg, 0.55),
        });
        // Relative: the empty and failure screens are laid over it.
        const listEl = el('div', {
            flex: '1 1 auto',
            minHeight: '0',
            overflowY: 'auto',
            padding: '4px 12px 8px',
            outline: 'none',
            position: 'relative',
        });
        listEl.tabIndex = 0;
        const foot = el('div', {
            flex: '0 0 auto',
            padding: '5px 20px 8px',
            borderTop: theme.border,
            font: '11.5px ' + theme.font,
            color: ui.blend(theme.contentColor, theme.contentBg, 0.55),
        });
        content.append(head, columnsHead, listEl, foot);
        new ResizeObserver(() => {
            const w = content.clientWidth;
            const next = COLUMNS.filter((c) => (c.key === 'kind' ? w >= 620 : c.key === 'size' ? w >= 470 : true));
            if (next.length !== shown.length) {
                shown = next;
                render();
            }
        }).observe(content);

        const KINDS = {
            swift: 'Swift Source',
            m: 'Objective-C Source',
            h: 'C Header',
            c: 'C Source',
            kt: 'Kotlin Source',
            java: 'Java Source',
            js: 'JavaScript',
            ts: 'TypeScript',
            tsx: 'TSX',
            jsx: 'JSX',
            py: 'Python Script',
            rb: 'Ruby Script',
            go: 'Go Source',
            rs: 'Rust Source',
            sh: 'Shell Script',
            json: 'JSON',
            yaml: 'YAML',
            yml: 'YAML',
            toml: 'TOML',
            xml: 'XML',
            plist: 'Property List',
            md: 'Markdown',
            txt: 'Plain Text',
            html: 'HTML',
            css: 'CSS',
            csv: 'CSV',
            log: 'Log File',
            pdf: 'PDF Document',
            png: 'PNG Image',
            jpg: 'JPEG Image',
            jpeg: 'JPEG Image',
            gif: 'GIF Image',
            heic: 'HEIC Image',
            svg: 'SVG Image',
            webp: 'WebP Image',
            mov: 'QuickTime Movie',
            mp4: 'MPEG-4 Movie',
            mp3: 'MP3 Audio',
            wav: 'WAV Audio',
            zip: 'ZIP Archive',
            gz: 'GZip Archive',
            tar: 'Tar Archive',
            dmg: 'Disk Image',
            pkg: 'Installer Package',
            docx: 'Word Document',
            xlsx: 'Excel Workbook',
            pptx: 'PowerPoint',
            key: 'Keynote',
            pages: 'Pages',
            numbers: 'Numbers',
            app: 'Application',
            xcodeproj: 'Xcode Project',
            xcworkspace: 'Xcode Workspace',
            playground: 'Playground',
            ipa: 'iOS App',
            strings: 'Strings File',
            sqlite: 'SQLite Database',
        };
        const kindOf = (e) =>
            e.kind === 'folder'
                ? 'Folder'
                : KINDS[e.ext] ||
                  (e.kind === 'package' ? 'Package' : e.ext ? e.ext.toUpperCase() + ' File' : 'Document');
        // Decimal, as the system's Finder counts: 1 KB is 1000 bytes.
        const sizeOf = (e) => {
            if (e.size == null) return '--';
            const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
            let n = e.size,
                u = 0;
            while (n >= 1000 && u < units.length - 1) {
                n /= 1000;
                u++;
            }
            return u === 0 ? `${n} bytes` : `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
        };
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const pad = (n) => String(n).padStart(2, '0');
        const whenOf = (ms) => {
            const d = new Date(ms),
                now = new Date();
            const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            const diff = Math.round((day(now) - day(d)) / 86400000);
            if (diff === 0) return 'Today at ' + time;
            if (diff === 1) return 'Yesterday at ' + time;
            return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${time}`;
        };

        const iconUrls = new Map(); // key -> data URL, or null when there was none
        const asking = new Set();
        const iconKey = (e) =>
            e.kind === 'package' ? 'item:' + e.path : e.kind === 'folder' ? 'folder' : 'ext:' + e.ext;
        const askIcons = (list) => {
            const wanted = {};
            for (const e of list) {
                const k = iconKey(e);
                if (iconUrls.has(k) || asking.has(k)) continue;
                asking.add(k);
                wanted[k] = e.path;
            }
            if (!Object.keys(wanted).length) return;
            main.call('icons', wanted)
                .then((got) => {
                    let arrived = false;
                    for (const k of Object.keys(wanted)) {
                        asking.delete(k);
                        iconUrls.set(k, got?.[k] || null);
                        arrived = arrived || !!got?.[k];
                    }
                    if (arrived) render();
                })
                .catch(() => {
                    for (const k of Object.keys(wanted)) {
                        asking.delete(k);
                        iconUrls.set(k, null);
                    }
                });
        };
        const glyphFor = (e, size = 16) => {
            const url = iconUrls.get(iconKey(e));
            if (url) {
                const img = el('img', {
                    width: size + 'px',
                    height: size + 'px',
                    flex: '0 0 auto',
                    objectFit: 'contain',
                });
                img.src = url;
                img.draggable = false;
                return img;
            }
            const g = el('span', { display: 'flex', flex: '0 0 auto', opacity: '.6' });
            g.innerHTML = ui.icon(
                e.kind === 'folder' ? 'folder' : e.kind === 'package' ? 'grid' : 'fileText',
                size - 1
            );
            return g;
        };

        const showHidden = () => !!settings.get('showHidden');
        const shows = (e) => showHidden() || !e.hidden;
        const visibleIn = (dir) => {
            const k = sort.key,
                up = sort.up ? 1 : -1;
            const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            const value = (e) =>
                k === 'mtime' ? e.mtime : k === 'size' ? (e.size ?? -1) : k === 'kind' ? kindOf(e) : null;
            const query = dir === current?.queryDir ? current.query : '';
            const folder = (e) => e.kind === 'folder';
            return (listingOf(dir)?.list || [])
                .filter(shows)
                .filter((e) => !query || e.name.toLowerCase().includes(query))
                .sort((a, b) => {
                    if (settings.get('foldersFirst') && folder(a) !== folder(b)) return folder(a) ? -1 : 1;
                    if (k === 'name') return up * byName(a, b);
                    const va = value(a),
                        vb = value(b);
                    const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
                    return up * c || byName(a, b);
                });
        };
        const visible = () => visibleIn(hereNow());

        const paintHead = () => {
            columnsHead.style.gridTemplateColumns = template();
            columnsHead.textContent = '';
            for (const c of shown) {
                const cell = el('button', {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    justifyContent: c.right ? 'flex-end' : 'flex-start',
                    height: '100%',
                    padding: c.right ? '0 8px 0 0' : '0',
                    border: '0',
                    background: 'transparent',
                    color: sort.key === c.key ? theme.contentColor : 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    minWidth: '0',
                });
                cell.type = 'button';
                cell.title = 'Sort by ' + c.label.toLowerCase();
                cell.append(el('span', { overflow: 'hidden', textOverflow: 'ellipsis' }, c.label));
                if (sort.key === c.key) {
                    const caret = el('span', { display: 'flex' });
                    caret.innerHTML = ui.icon(sort.up ? 'chevronUp' : 'chevronDown', 12);
                    cell.appendChild(caret);
                }
                cell.addEventListener('click', () => {
                    sort =
                        sort.key === c.key
                            ? { key: c.key, up: !sort.up }
                            : { key: c.key, up: c.key === 'name' || c.key === 'kind' };
                    store.set('sort', sort);
                    render();
                });
                columnsHead.appendChild(cell);
            }
        };

        const quiet = ui.blend(theme.contentColor, theme.contentBg, 0.6);
        const rowFor = (e) => {
            const r = el('div', {
                display: 'grid',
                gridTemplateColumns: template(),
                alignItems: 'center',
                height: '26px',
                padding: '0 8px',
                borderRadius: '6px',
                cursor: 'default',
                whiteSpace: 'nowrap',
                opacity: e.hidden ? '.55' : '1',
            });
            r.dataset.path = e.path;
            const name = el('div', { display: 'flex', alignItems: 'center', gap: '7px', minWidth: '0' });
            const label = el('span', { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: '0' }, e.name);
            label.dataset.name = '';
            name.append(glyphFor(e), label);
            if (e.link) {
                const arrow = el('span', { display: 'flex', flex: '0 0 auto', color: quiet });
                arrow.innerHTML = ui.icon('externalWindow', 11);
                arrow.title = 'Alias';
                name.appendChild(arrow);
            }
            const cells = {
                name,
                mtime: el('div', { color: quiet, overflow: 'hidden', textOverflow: 'ellipsis' }, whenOf(e.mtime)),
                size: el(
                    'div',
                    { color: quiet, textAlign: 'right', paddingRight: '8px', fontVariantNumeric: 'tabular-nums' },
                    sizeOf(e)
                ),
                kind: el('div', { color: quiet, overflow: 'hidden', textOverflow: 'ellipsis' }, kindOf(e)),
            };
            for (const c of shown) r.appendChild(cells[c.key]);
            ui.hoverable(r, () => e.path === current?.selected);
            return r;
        };

        const COLUMN_MIN = 140,
            COLUMN_MAX = 640,
            COLUMN_WIDTH = 230,
            COLUMN_WIDTHS_KEEP = 64;
        const widthOf = (dir) => current?.widths[dir] ?? COLUMN_WIDTH;
        const sizeColumn = (col, px) => {
            col.style.flex = `0 0 ${Math.round(px)}px`;
        };
        /* The column being resized and its tab: a redraw meanwhile leaves its width alone, and the
       width is saved to that tab even if another is in front by then. */
        let sizing = null;
        const edgeOf = (col) => {
            const handle = el('div', {
                position: 'absolute',
                top: '0',
                bottom: '0',
                right: '-4px',
                width: '8px',
                cursor: 'col-resize',
                zIndex: '1',
            });
            handle.title = 'Drag to resize';
            ui.resizer(handle, {
                axis: 'x',
                size: () => col.getBoundingClientRect().width,
                min: COLUMN_MIN,
                max: COLUMN_MAX,
                // Held from the drag's start until commit, the spring back included.
                onDrag: (on) => {
                    if (on) sizing = { col, tab: current };
                },
                resize: (px) => {
                    if (sizing?.tab === current) sizeColumn(col, px);
                },
                commit: (px) => {
                    const tab = sizing?.tab;
                    sizing = null;
                    if (!tab) return;
                    // Re-inserted so that key order is recency and the slice drops the oldest.
                    const { [col.dataset.dir]: _, ...rest } = tab.widths;
                    const kept = Object.entries({ ...rest, [col.dataset.dir]: Math.round(px) }).slice(
                        -COLUMN_WIDTHS_KEEP
                    );
                    tab.widths = Object.fromEntries(kept);
                    persistTabs();
                },
            });
            return handle;
        };
        const onPath = (p) => !!current?.selected && (current.selected === p || current.selected.startsWith(p + '/'));
        const cellFor = (e) => {
            const r = el('div', {
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                height: '24px',
                padding: '0 6px',
                borderRadius: '6px',
                cursor: 'default',
                whiteSpace: 'nowrap',
                opacity: e.hidden ? '.55' : '1',
            });
            r.dataset.path = e.path;
            const label = el(
                'span',
                { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: '0' },
                e.name
            );
            label.dataset.name = '';
            r.append(glyphFor(e), label);
            if (e.kind === 'folder') {
                const more = el('span', { display: 'flex', flex: '0 0 auto', color: quiet });
                more.innerHTML = ui.icon('chevronRight', 12);
                r.appendChild(more);
            }
            // Presses are handled on listEl, which tells a double click even across a redraw.
            ui.hoverable(r, () => onPath(e.path));
            return r;
        };
        // Keyed by mtime too, so a file saved again gets a new thumbnail.
        const THUMBNAIL_SIZE = 480; // pixels, twice the preview's room, for a Retina screen
        const THUMBNAILS_KEPT = 24;
        const thumbnails = new Map(); // "path|mtime" -> data URL, or null when Quick Look had none
        const thumbnailRequests = new Map();
        const thumbnailKey = (e) => e.path + '|' + e.mtime;
        const thumbnailFor = (e) => {
            const key = thumbnailKey(e);
            if (!thumbnailRequests.has(key)) {
                thumbnailRequests.set(
                    key,
                    main
                        .call('thumbnail', e.path, THUMBNAIL_SIZE)
                        .catch(() => null)
                        .then((url) => {
                            thumbnailRequests.delete(key);
                            thumbnails.set(key, url || null);
                            while (thumbnails.size > THUMBNAILS_KEPT) thumbnails.delete(thumbnails.keys().next().value);
                            return url || null;
                        })
                );
            }
            return thumbnailRequests.get(key);
        };
        const thumbnailOf = (url) => {
            const img = el('img', {
                maxWidth: '100%',
                maxHeight: 'min(240px, 50%)',
                objectFit: 'contain',
                borderRadius: '4px',
            });
            img.src = url;
            img.draggable = false;
            return img;
        };
        // The size of the system's icons (main's icons): drawn larger, they blur.
        const ICON_POINTS = 32;
        const previewOf = (e) => {
            const col = el('div', {
                flex: '1 0 240px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '16px',
                boxSizing: 'border-box',
                textAlign: 'center',
            });
            col.dataset.preview = e.path;
            const known = thumbnails.get(thumbnailKey(e));
            const picture = known ? thumbnailOf(known) : glyphFor(e, ICON_POINTS);
            if (!thumbnails.has(thumbnailKey(e))) {
                thumbnailFor(e).then((url) => {
                    if (url && col.isConnected && col.dataset.preview === e.path) picture.replaceWith(thumbnailOf(url));
                });
            }
            col.append(
                picture,
                el('div', { font: '600 13px ' + theme.font, overflowWrap: 'anywhere', marginTop: '10px' }, e.name),
                el('div', { color: quiet }, kindOf(e) + (e.size == null ? '' : ' \u00b7 ' + sizeOf(e))),
                el('div', { color: quiet }, whenOf(e.mtime))
            );
            return col;
        };
        /* A column is rebuilt only when this changes, so it keeps its scroll and the row under the
       pointer survives a pick. Another column's icons arriving is no reason to rebuild this one. */
        const columnKey = (dir) =>
            [
                listingOf(dir)?.v ?? '-',
                dir === current?.queryDir ? current.query : '',
                sort.key,
                sort.up,
                showHidden(),
                !!settings.get('foldersFirst'),
                visibleIn(dir)
                    .map((e) => (iconUrls.get(iconKey(e)) ? 1 : 0))
                    .join(''),
            ].join('|');
        const drawColumns = () => {
            const dirs = columnDirs();
            const kept = new Map([...listEl.querySelectorAll(':scope > [data-dir]')].map((c) => [c.dataset.dir, c]));
            // Also removes the list view's rows and the preview.
            for (const child of [...listEl.children]) if (!dirs.includes(child.dataset.dir)) child.remove();
            dirs.forEach((dir, i) => {
                let col = kept.get(dir);
                if (!col) {
                    // Rows scroll in a body of their own so the resize edge stays put.
                    col = el('div', {
                        position: 'relative',
                        flex: `0 0 ${widthOf(dir)}px`,
                        height: '100%',
                        borderRight: theme.border,
                    });
                    col.dataset.dir = dir;
                    col.body = el('div', {
                        height: '100%',
                        overflowY: 'auto',
                        padding: '4px 6px',
                        boxSizing: 'border-box',
                    });
                    col.append(col.body, edgeOf(col));
                } else if (!(col === sizing?.col && sizing.tab === current)) {
                    // A column kept from another tab of the same folder takes this tab's width.
                    sizeColumn(col, widthOf(dir));
                }
                if (listEl.children[i] !== col) listEl.insertBefore(col, listEl.children[i] || null);
                const key = columnKey(dir);
                const body = col.body;
                if (col.dataset.key === key) {
                    for (const r of body.children) r.repaint?.();
                    return;
                }
                col.dataset.key = key;
                const top = body.scrollTop;
                body.textContent = '';
                const got = listingOf(dir);
                // The drawing asks for the read, so no path to a column can forget to.
                if (!got) {
                    loadDir(dir);
                    body.appendChild(el('div', { padding: '8px 6px', color: quiet }, 'Loading\u2026'));
                } else if (got.failure)
                    body.appendChild(
                        el('div', { padding: '8px 6px', color: quiet, whiteSpace: 'normal' }, got.failure.title)
                    );
                else {
                    const list = visibleIn(dir);
                    askIcons(list);
                    for (const e of list) body.appendChild(cellFor(e));
                    if (!list.length)
                        body.appendChild(
                            el(
                                'div',
                                { padding: '8px 6px', color: quiet },
                                dir === current?.queryDir && current.query ? 'Nothing here matches' : 'Empty'
                            )
                        );
                }
                body.scrollTop = top;
            });
            const picked = entryOf(current?.selected);
            if (picked && picked.kind !== 'folder' && dirs.includes(parentOf(picked.path)))
                listEl.appendChild(previewOf(picked));
        };

        const LAYOUT = {
            list: { display: 'block', overflowX: 'hidden', overflowY: 'auto', padding: '4px 12px 8px' },
            columns: { display: 'flex', overflowX: 'auto', overflowY: 'hidden', padding: '0 0 0 6px' },
        };

        // Through whenFree: a row being renamed keeps its field until the name is in.
        const render = () => ui.whenFree(listEl, draw);
        const draw = () => {
            reconcile();
            const columns = view === 'columns' && !loading() && !listingOf(hereNow())?.failure && !startFailure;
            columnsHead.style.display = view === 'columns' ? 'none' : 'grid';
            Object.assign(listEl.style, LAYOUT[columns ? 'columns' : 'list']);
            if (columns) drawColumns();
            else drawList();
            const counted = current?.query ? current.queryDir : walkDir();
            const total = (listingOf(counted)?.list || []).filter(shows).length;
            const n = current?.query ? visibleIn(counted).length : total;
            const failure = loading() ? null : listingOf(hereNow())?.failure || startFailure;
            foot.textContent =
                failure || loading()
                    ? ''
                    : current?.query
                      ? `${n} of ${total} item${total === 1 ? '' : 's'}`
                      : `${n} item${n === 1 ? '' : 's'}`;
            paintCrumbs();
            backBtn.setEnabled(!!current && current.back.length > 0);
            aheadBtn.setEnabled(!!current && current.ahead.length > 0);
            upBtn.setEnabled(!!hereNow() && hereNow() !== '/');
        };
        const drawList = () => {
            paintHead();
            const scroll = listEl.scrollTop;
            listEl.textContent = '';
            const failure = loading() ? null : listingOf(hereNow())?.failure || startFailure;
            const screen = (state) => {
                Object.assign(state.style, { position: 'absolute', inset: '0' });
                listEl.appendChild(state);
            };
            const here = hereNow();
            if (loading()) {
                listEl.appendChild(el('div', { padding: '18px 8px', color: quiet }, 'Loading\u2026'));
            } else if (failure) {
                screen(
                    ui.emptyState({
                        icon: ui.icon('folder', 44),
                        title: failure.title,
                        hint: failure.hint,
                        actions: failure.permission
                            ? [
                                  ui.textBtn(
                                      'Open Privacy Settings',
                                      '',
                                      () => main.call('privacySettings').catch(() => {}),
                                      { size: 'sm' }
                                  ),
                              ]
                            : [],
                    })
                );
            } else {
                const list = visible();
                askIcons(list);
                for (const e of list) listEl.appendChild(rowFor(e));
                if (!list.length && current?.query)
                    listEl.appendChild(el('div', { padding: '18px 8px', color: quiet }, 'Nothing here matches'));
                else if (!list.length && here) {
                    screen(
                        ui.emptyState({
                            icon: ui.icon('folder', 44),
                            title: 'This folder is empty',
                            hint: entries().length ? 'What is in it is hidden.' : '',
                            actions: [
                                ...(entries().length
                                    ? [
                                          ui.tip(
                                              ui.textBtn(
                                                  'Show Hidden Files',
                                                  '',
                                                  () => settings.set('showHidden', true),
                                                  { size: 'sm' }
                                              ),
                                              'Show hidden files',
                                              chordFor('hidden')
                                          ),
                                      ]
                                    : []),
                                ui.textBtn('Show in Finder', '', () => host.reveal(here), { size: 'sm' }),
                            ],
                        })
                    );
                }
            }
            listEl.scrollTop = scroll;
        };

        const paintCrumbs = () => {
            const picked = view === 'columns' ? current?.selected : null;
            const here = picked && columnDirs().includes(parentOf(picked)) ? picked : hereNow();
            const parts = [];
            for (let p = here; p; p = parentOf(p)) {
                parts.unshift(p);
                if (p === home) break;
            }
            crumbs.setParts(
                parts.map((p, i) => ({
                    key: p,
                    label: nameOf(p),
                    title: tilde(p),
                    icon: 'folder',
                    current: i === parts.length - 1,
                }))
            );
        };

        let seq = 0;
        let listingSeq = 0;
        const read = async (dir) => {
            try {
                return { list: (await main.call('list', dir)) || [], failure: null, v: ++listingSeq };
            } catch (e) {
                const said = String(e?.message || e);
                return {
                    list: [],
                    v: ++listingSeq,
                    failure: /EACCES|EPERM|not permitted/i.test(said)
                        ? {
                              title: host.about().name + ' cannot read this folder',
                              hint: 'macOS gives an app a folder in System Settings \u203a Privacy & Security \u203a Files and Folders.',
                              permission: true,
                          }
                        : { title: 'Could not read this folder', hint: said, permission: false },
                };
            }
        };
        const shownDirs = () => (view === 'columns' ? columnDirs() : hereNow() ? [hereNow()] : []);
        const prune = () => {
            const keep = new Set([...tabs.map((t) => t.here), ...shownDirs()]);
            for (const dir of listings.keys()) if (!keep.has(dir)) listings.delete(dir);
        };

        /* Holds the pick to what is on screen; run before every draw. A pick the filter hides stays
       picked. One whose folder no longer holds it is cut back to the deepest folder that does (as
       Finder after a Trash); one whose folder is unread waits. The filter goes when its folder does. */
        const reconcile = () => {
            const t = current;
            if (!t?.here) return;
            if (t.selected) {
                const sel = t.selected;
                const under = sel.startsWith(t.here === '/' ? '/' : t.here + '/');
                const steps = under ? sel.slice(t.here === '/' ? 1 : t.here.length + 1).split('/') : [];
                const join = (p, name) => (p === '/' ? '/' + name : p + '/' + name);
                let kept = null,
                    p = t.here;
                for (const name of steps) {
                    const next = join(p, name);
                    const listing = listingOf(p);
                    if (!listing) {
                        kept = view === 'list' ? join(t.here, steps[0]) : sel;
                        break;
                    }
                    if (!listing.list.some((e) => e.path === next && shows(e))) break;
                    kept = next;
                    if (view === 'list') break;
                    p = next;
                }
                t.selected = kept;
            }
            if (t.query && !shownDirs().includes(t.queryDir)) {
                t.query = '';
                t.queryDir = null;
                search.setValue('');
            }
        };

        /* A read asked for during another is not answered by it (the folder may have changed since):
       the folder is read again when it ends, so what comes back is no older than the asking. */
        const reads = new Map(); // dir -> { again, done }
        const loadDir = (dir) => {
            const under = reads.get(dir);
            if (under) {
                under.again = true;
                return under.done;
            }
            const entry = { again: false, done: null };
            entry.done = (async () => {
                do {
                    entry.again = false;
                    arrived(dir, await read(dir));
                } while (entry.again);
                reads.delete(dir);
            })();
            reads.set(dir, entry);
            return entry.done;
        };
        const arrived = (dir, got) => {
            const t = current;
            if (!t || !shownDirs().includes(dir)) return;
            listings.set(dir, got);
            const intent = dir === t.here ? t.pending : null;
            if (intent) {
                t.pending = null;
                if (intent.select) t.selected = intent.select;
            }
            prune();
            render();
            if (typeof intent?.scroll === 'number') listEl.scrollTop = intent.scroll;
            else if (intent?.scroll === 'reveal' && t.selected) reveal(t.selected);
            // Resetting `watching` makes watchShown ask main again, renewing a watch that died.
            if (dir === t.here) watching = undefined;
            watchShown();
        };
        const load = () => (hereNow() ? loadDir(hereNow()) : undefined);

        let showing = false;
        let watching; // the set last sent, as JSON; undefined lets the next call through
        // A set main could not fully watch is forgotten, so the next read asks again.
        const watchOnly = (dirs) => {
            const key = JSON.stringify(dirs || []);
            if (key === watching) return;
            watching = key;
            const forget = () => {
                if (watching === key) watching = undefined;
            };
            main.call('watch', dirs || null).then((got) => {
                if (!Array.isArray(got) || got.length !== (dirs || []).length) forget();
            }, forget);
        };
        const watchShown = () =>
            watchOnly(showing && hereNow() ? (view === 'columns' ? columnDirs() : [hereNow()]) : null);

        // The sidebar is repainted here, not on every draw: only arriving changes which favorite is lit.
        const arrive = (t, intent) => {
            t.pending = intent;
            watchShown();
            persistTabs();
            paintPlaces();
            // Drawn now, so the list says it is loading rather than showing the last folder's rows.
            render();
            return load();
        };

        const go = (dir, { from = null, history = true } = {}) => {
            const t = current;
            if (!t || !dir || dir === t.here) return;
            if (history && t.here) {
                t.back.push(t.here);
                t.ahead.length = 0;
            }
            t.here = dir;
            t.selected = null;
            t.query = '';
            t.queryDir = null;
            search.setValue('');
            return arrive(t, { select: from, scroll: from ? 'reveal' : 0 });
        };
        const goBack = () => {
            const t = current;
            if (!t?.back.length) return;
            t.ahead.push(t.here);
            go(t.back.pop(), { history: false });
        };
        const goAhead = () => {
            const t = current;
            if (!t?.ahead.length) return;
            t.back.push(t.here);
            go(t.ahead.pop(), { history: false });
        };
        const goUp = () => {
            const here = hereNow();
            const up = here && parentOf(here);
            if (up) go(up, { from: here });
        };
        const onScreen = (dir) => dir === hereNow() || (view === 'columns' && columnDirs().includes(dir));
        main.on('changed', (dir) => {
            if (onScreen(dir)) loadDir(dir);
        });
        main.on('unwatched', (dir) => {
            watching = undefined;
            if (onScreen(dir)) loadDir(dir);
        });

        const reveal = (p) => {
            listEl
                .querySelector(`[data-path="${CSS.escape(p)}"]`)
                ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (view === 'columns') listEl.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        };
        /* No scroll unless asked: a right click selects its row, and scrolling would close the menu
       just opened there. */
        const select = (p, { reveal: show = false } = {}) => {
            if (!current) return;
            current.selected = p;
            if (view === 'columns') {
                render();
                watchShown();
            } else {
                // Repainted in place, so the row under the pointer keeps its hover.
                for (const r of listEl.children) r.repaint?.();
            }
            if (show && p) reveal(p);
        };
        /* A second press soon after and where the first was opens what the first was on, even if the
       columns have since moved another row under the pointer. A right click or ⌃-click is the menu's. */
        const DOUBLE_MS = 500;
        let lastPress = null;
        const openFromPress = (entry, ev) =>
            ev.metaKey && entry.kind === 'folder'
                ? newTab(entry.path)
                : openEntry(entry, { usesDefaultApp: ev.altKey });
        let picking = null; // the path a press in columns is on, picked if the press ends as a click
        listEl.addEventListener('mousedown', (ev) => {
            if (ev.button !== 0 || ev.ctrlKey) return;
            const now = Date.now();
            const again =
                lastPress &&
                now - lastPress.at < DOUBLE_MS &&
                Math.abs(ev.clientX - lastPress.x) < 5 &&
                Math.abs(ev.clientY - lastPress.y) < 5;
            if (again) {
                const { entry } = lastPress;
                lastPress = null;
                ev.preventDefault();
                openFromPress(entry, ev);
                return;
            }
            const entry = entryOf(ev.target.closest?.('[data-path]')?.dataset.path);
            lastPress = entry ? { entry, at: now, x: ev.clientX, y: ev.clientY } : null;
            /* In columns picking moves the columns, so it waits for the press to end as a click: a press
         that becomes a drag must leave them as they were. */
            picking = null;
            if (entry && view === 'columns') picking = entry.path;
            else if (entry) select(entry.path);
        });
        listEl.addEventListener('click', (ev) => {
            const p = picking;
            picking = null;
            if (p && ev.target.closest?.('[data-path]')?.dataset.path === p) select(p, { reveal: true });
        });

        const say = (text) => {
            foot.textContent = text;
            setTimeout(() => render(), 2500);
        };
        const openEntry = async (e, { usesDefaultApp = false } = {}) => {
            if (!e) return;
            if (e.kind === 'folder') return go(e.path);
            const opened = await host
                .open(host.fileURL(e.path), { usesDefaultApp, userInitiated: true })
                .catch(() => false);
            if (!opened) say('Could not open \u201c' + e.name + '\u201d');
        };
        const quickLook = (e) => {
            if (e) main.call('quickLook', e.path, e.name).catch(() => {});
        };
        const copyPath = (p) => host.clipboard.writeText(p).catch(() => {});
        const addFavorite = (p) => {
            if (!favorites().includes(p)) setFavorites([...favorites(), p]);
        };

        const said = (err) => String(err?.message || err);
        const relocate = (from, to) => {
            const follow = (p) => util.movePath(p, from, to);
            const up = parentOf(from) || '/';
            // Drops paths that went, and the repeats in a row that leaves.
            const history = (list) =>
                list.map(follow).reduce((out, p) => (p && p !== out[out.length - 1] ? [...out, p] : out), []);
            for (const t of tabs) {
                t.here = follow(t.here) ?? up;
                t.back = history(t.back);
                t.ahead = history(t.ahead);
                // A pick that went is left as is; reconcile cuts it back once the listings no longer hold it.
                t.selected = t.selected && (follow(t.selected) ?? t.selected);
            }
            /* Applied to the listings now, before the folders are read again, so a draw in between (the
         rename field letting go) finds the new name rather than dropping the pick. An item moved
         into another folder joins that folder's listing. */
            const arrived = [];
            for (const [dir, got] of [...listings]) {
                listings.delete(dir);
                const at = follow(dir);
                if (!at) continue;
                const list = [];
                for (const e of got.list) {
                    const p = follow(e.path);
                    if (!p) continue;
                    const now = { ...e, path: p, name: p === e.path ? e.name : p.slice(p.lastIndexOf('/') + 1) };
                    if (parentOf(p) === at) list.push(now);
                    else arrived.push(now);
                }
                listings.set(at, { ...got, list, v: ++listingSeq });
            }
            for (const e of arrived) {
                const got = listings.get(parentOf(e.path));
                if (got && !got.list.some((x) => x.path === e.path))
                    listings.set(parentOf(e.path), { ...got, list: [...got.list, e], v: ++listingSeq });
            }
            const widthsFollowed = (widths) =>
                Object.fromEntries(
                    Object.entries(widths || {}).flatMap(([dir, px]) => {
                        const at = follow(dir);
                        return at ? [[at, px]] : [];
                    })
                );
            for (const t of tabs) t.widths = widthsFollowed(t.widths);
            const reopened = closedTabs
                .map((c) => ({ ...c, here: follow(c.here), widths: widthsFollowed(c.widths) }))
                .filter((c) => c.here);
            closedTabs.splice(0, closedTabs.length, ...reopened);
            const favs = favorites();
            if (favs.some((p) => follow(p) !== p)) setFavorites(favs.map(follow).filter(Boolean));
            persistTabs();
        };
        const renameEntry = async (e) => {
            const label = listEl.querySelector(`[data-path="${CSS.escape(e.path)}"] [data-name]`);
            if (!label) return;
            select(e.path);
            const renamed = await ui.inlineEdit(label, {
                stem: e.kind !== 'folder',
                commit: async (name) => {
                    try {
                        relocate(e.path, await main.call('rename', e.path, name));
                    } catch (err) {
                        return said(err);
                    }
                },
            });
            if (renamed) loadDir(parentOf(e.path));
        };
        const newFolder = async (into = folderNow()) => {
            const t = current,
                here = hereNow();
            if (!t || !into) return;
            let made;
            try {
                made = await main.call('mkdir', into);
            } catch (err) {
                say('Could not make a folder: ' + said(err));
                return;
            }
            if (current !== t || t.here !== here) return;
            t.query = '';
            t.queryDir = null;
            search.setValue('');
            if (into === here) {
                t.pending = { select: made, scroll: 'reveal' };
                await load();
            } else {
                await loadDir(into);
                select(made, { reveal: true });
            }
            const e = entryOf(made);
            if (e) renameEntry(e);
        };
        const trashEntry = (e) => {
            if (!e) return;
            const send = async () => {
                try {
                    await main.call('trash', e.path);
                } catch (err) {
                    say('Could not move \u201c' + e.name + '\u201d to the Trash: ' + said(err));
                    return;
                }
                relocate(e.path, null);
                loadDir(parentOf(e.path));
            };
            if (e.kind !== 'folder') return send();
            ui.dialog({
                title: `Move \u201c${e.name}\u201d to the Trash?`,
                destructive: true,
                confirmLabel: 'Move to Trash',
                message: 'The folder and everything in it go to the macOS Trash, from where Finder can put them back.',
                onConfirm: send,
            });
        };

        const MOVE = 'finder-entry';
        const moveEntry = async (from, into) => {
            if (!ui.movesInto(from, into)) return;
            let to;
            try {
                to = await main.call('move', from, into);
            } catch (err) {
                // A dialog, not say(): the footer is redrawn right after a drag ends.
                ui.dialog({
                    title: 'Could not move \u201c' + nameOf(from) + '\u201d',
                    message: said(err),
                    confirmLabel: 'OK',
                });
                return;
            }
            relocate(from, to);
            loadDir(parentOf(from));
            loadDir(into);
        };
        const dropZone = (zone, folderAt) =>
            ui.folderDrop(zone, {
                kind: MOVE,
                path: (held) => held.path,
                folderAt,
                onDrop: (held, place) => moveEntry(held.path, place.folder),
            });
        dropZone(crumbs, (at) => {
            const b = at.closest?.('[data-crumb]');
            return b ? { folder: b.dataset.crumb, mark: b } : null;
        });
        ui.dragSource(listEl, {
            itemAt: (t) => t.closest?.('[data-path]') || null,
            what: (r) => {
                const e = entryOf(r.dataset.path);
                return (
                    e && {
                        kind: MOVE,
                        payload: { path: e.path },
                        text: e.name,
                        icon:
                            e.kind === 'folder' ? ui.folderIcon(false, 14) : e.kind === 'package' ? 'grid' : 'fileText',
                    }
                );
            },
        });
        dropZone(listEl, (at) => {
            const r = at.closest?.('[data-path]');
            const e = r && entryOf(r.dataset.path);
            if (e?.kind === 'folder') return { folder: e.path, mark: r };
            const col = at.closest?.('[data-dir], [data-preview]');
            if (col?.dataset.dir) return { folder: col.dataset.dir, mark: col };
            // The preview stands for the picked file, in the last column's folder.
            if (col?.dataset.preview) {
                const dir = parentOf(col.dataset.preview);
                return { folder: dir, mark: listEl.querySelector(`:scope > [data-dir="${CSS.escape(dir)}"]`) || col };
            }
            const here = hereNow();
            return here && !loading() ? { folder: here, mark: listEl } : null;
        });

        const itemItems = (e) => {
            const isFav = favorites().includes(e.path);
            return [
                { label: 'Open', icon: e.kind === 'folder' ? 'folder' : 'externalWindow', run: () => openEntry(e) },
                ...(e.kind === 'folder'
                    ? [{ label: 'Open in New Tab', icon: 'window', hint: '\u2318', run: () => newTab(e.path) }]
                    : []),
                ...(e.kind === 'folder'
                    ? []
                    : [
                          {
                              label: 'Open with Default App',
                              hint: '⌥',
                              run: () => openEntry(e, { usesDefaultApp: true }),
                          },
                      ]),
                { label: 'Quick Look', icon: 'eye', hint: 'Space', run: () => quickLook(e) },
                '-',
                { label: 'Rename\u2026', icon: 'pencil', run: () => renameEntry(e) },
                { label: 'Move to Trash', icon: 'trash', hint: host.chordOf('trash'), run: () => trashEntry(e) },
                '-',
                { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(e.path) },
                { label: 'Copy Path', icon: 'copy', run: () => copyPath(e.path) },
                ...(e.kind === 'folder'
                    ? [
                          '-',
                          isFav
                              ? {
                                    label: 'Remove from Favorites',
                                    icon: 'star',
                                    run: () => setFavorites(favorites().filter((p) => p !== e.path)),
                                }
                              : { label: 'Add to Favorites', icon: 'star', run: () => addFavorite(e.path) },
                      ]
                    : []),
            ];
        };
        ui.contextMenu(listEl, {
            rowAt: (t) => t.closest?.('[data-path]') || t.closest?.('[data-dir]') || null,
            keyRow: () =>
                current?.selected ? listEl.querySelector(`[data-path="${CSS.escape(current.selected)}"]`) : null,
            items: (row) => {
                if (row?.dataset.path) {
                    const e = entryOf(row.dataset.path);
                    if (!e) return null;
                    select(e.path);
                    return itemItems(e);
                }
                const here = row?.dataset.dir || folderNow();
                return here
                    ? [
                          {
                              label: 'New Folder',
                              icon: 'folderPlus',
                              hint: host.chordOf('newFolder'),
                              run: () => newFolder(here),
                          },
                          '-',
                          { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(here) },
                          { label: 'Copy Path', icon: 'copy', run: () => copyPath(here) },
                          {
                              label: 'Add to Favorites',
                              icon: 'star',
                              disabled: favorites().includes(here),
                              run: () => addFavorite(here),
                          },
                          '-',
                          {
                              label: 'Show Hidden Files',
                              checked: showHidden(),
                              hint: host.chordOf('hidden'),
                              run: () => settings.set('showHidden', !showHidden()),
                          },
                      ]
                    : null;
            },
        });

        let typed = '',
            typedAt = 0;
        listEl.addEventListener('keydown', async (ev) => {
            const sel = current?.selected;
            const dir = walkDir();
            const list = visibleIn(dir);
            const i = list.findIndex((e) => e.path === sel);
            // ⌘↑ and ⌘↓ are chords (keys below).
            if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && !ev.metaKey) {
                ev.preventDefault();
                const next =
                    list[Math.max(0, Math.min(list.length - 1, i < 0 ? 0 : i + (ev.key === 'ArrowDown' ? 1 : -1)))];
                if (next) select(next.path, { reveal: true });
            } else if (view === 'columns' && ev.key === 'ArrowRight') {
                ev.preventDefault();
                if (entryOf(sel)?.kind !== 'folder') return;
                if (!listings.has(sel)) await loadDir(sel);
                const first = visibleIn(sel)[0];
                if (first && current?.selected === sel) select(first.path, { reveal: true });
            } else if (view === 'columns' && ev.key === 'ArrowLeft') {
                ev.preventDefault();
                if (sel && dir !== hereNow()) select(dir, { reveal: true });
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                openEntry(list[i], { usesDefaultApp: ev.altKey });
            } else if (ev.key === ' ') {
                ev.preventDefault();
                quickLook(list[i]);
            } else if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
                const now = Date.now();
                typed = now - typedAt > 800 ? ev.key.toLowerCase() : typed + ev.key.toLowerCase();
                typedAt = now;
                const hit = list.find((e) => e.name.toLowerCase().startsWith(typed));
                if (hit) select(hit.path, { reveal: true });
            }
        });

        const TABS_CLOSED_KEEP = 10;
        const saved = data.get('tabs', null);
        const tabs = [];
        const closedTabs = Array.isArray(saved?.closed)
            ? saved.closed.filter((c) => c && c.here).slice(-TABS_CLOSED_KEEP)
            : [];
        let tabSeq = 0;
        const persistTabs = () => {
            data.set('tabs', {
                list: tabs.map((t) => ({ here: t.here, widths: t.widths })),
                active: Math.max(0, tabs.indexOf(current)),
                closed: closedTabs,
            });
            renderTabs();
        };
        const showTab = (id) => {
            const t = tabs.find((x) => x.id === id);
            // Showing the tab in front again would read it again, emptying the list and losing the scroll.
            if (!t || t === current) return;
            // Only a loaded list's scroll is the tab's own.
            if (current && listings.has(current.here)) current.scroll = listEl.scrollTop;
            current = t;
            search.setValue(t.query || '');
            return arrive(t, { select: t.selected, scroll: t.scroll });
        };
        const widthsFrom = (saved) =>
            Object.fromEntries(
                Object.entries(saved && typeof saved === 'object' ? saved : {})
                    .filter(([dir, px]) => typeof dir === 'string' && dir.startsWith('/') && Number.isFinite(px))
                    .map(([dir, px]) => [dir, Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, Math.round(px)))])
            );
        const newTab = (dir = hereNow() || home, { background = false, widths = null } = {}) => {
            const t = {
                id: ++tabSeq,
                here: dir,
                back: [],
                ahead: [],
                selected: null,
                query: '',
                queryDir: null,
                scroll: 0,
                widths: widthsFrom(widths),
            };
            tabs.push(t);
            if (background || !dir) persistTabs();
            else showTab(t.id);
            return t.id;
        };
        const closeTab = (id) => {
            const at = tabs.findIndex((t) => t.id === id);
            if (at < 0) return;
            const gone = tabs[at];
            closedTabs.push({ here: gone.here, at, widths: gone.widths });
            closedTabs.splice(0, Math.max(0, closedTabs.length - TABS_CLOSED_KEEP));
            tabs.splice(at, 1);
            if (gone !== current) return persistTabs();
            current = null;
            if (!tabs.length) return newTab(home);
            showTab(tabs[Math.max(0, at - 1)].id);
        };
        const dropTab = (id) => {
            const row = tabList.querySelector(`[data-tab-id="${id}"]`);
            if (!row || tabs.length === 1) return closeTab(id);
            ui.leaveRow(row, () => closeTab(id));
        };
        const reopenTab = () => {
            const last = closedTabs.pop();
            if (!last) return;
            const id = newTab(last.here, { background: true, widths: last.widths });
            const at = tabs.findIndex((t) => t.id === id);
            const want = Math.min(Math.max(0, last.at | 0), tabs.length - 1);
            if (want !== at) tabs.splice(want, 0, tabs.splice(at, 1)[0]);
            showTab(id);
        };

        const sidebar = el('div', { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' });
        const PLACE_ICON = {
            home: 'home',
            desktop: 'monitor',
            documents: 'fileText',
            downloads: 'download',
            applications: 'grid',
        };
        const folds = () => store.get('folds', {});
        const setFold = (key, on) => store.set('folds', { ...folds(), [key]: on });

        const tabSection = ui.section('Tabs', {
            icon: ui.icon('window', 16),
            actions: [{ title: 'New tab', run: () => newTab() }],
            collapsed: !!folds().tabs,
            onCollapse: (on) => setFold('tabs', on),
        });
        ui.tip(tabSection.actions[0], 'New tab', chordFor('newTab'));
        const tabList = ui.list();
        tabSection.body.appendChild(tabList);
        ui.sortable(tabList, (from, to) => {
            const [t] = tabs.splice(from, 1);
            tabs.splice(to, 0, t);
            persistTabs();
        });

        const favSection = ui.section('Favorites', {
            icon: ui.icon('star', 16),
            collapsed: !!folds().favorites,
            onCollapse: (on) => setFold('favorites', on),
        });
        const favList = ui.list();
        favSection.body.appendChild(favList);
        ui.sortable(favList, (from, to) => {
            const list = favorites();
            const [p] = list.splice(from, 1);
            list.splice(to, 0, p);
            setFavorites(list);
        });
        sidebar.append(tabSection, favSection);
        dropZone(favList, (at) => {
            const r = at.closest?.('[data-path]');
            return r ? { folder: r.dataset.path, mark: r } : null;
        });
        dropZone(tabList, (at) => {
            const r = at.closest?.('[data-tab-id]');
            const t = r && tabs.find((x) => String(x.id) === r.dataset.tabId);
            return t?.here ? { folder: t.here, mark: r } : null;
        });

        const folderRow = (glyph, label, title) => {
            const r = ui.row();
            const g = el('span', { display: 'flex', flex: '0 0 auto', opacity: '.8' });
            g.innerHTML = ui.icon(glyph, 16);
            const t = el(
                'span',
                { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' },
                label
            );
            r.title = title;
            r.append(g, t);
            return r;
        };
        // Through whenFree: a row being dragged or on its way out owns the list until it is done.
        const renderTabs = () => ui.whenFree(tabList, drawTabs);
        const drawTabs = () => {
            tabList.textContent = '';
            for (const t of tabs) {
                const r = folderRow('folder', t.here ? nameOf(t.here) : '\u2026', t.here ? tilde(t.here) : '');
                r.dataset.tabId = String(t.id);
                r.appendChild(
                    ui.tip(
                        ui.miniBtn(ui.icon('x', 14), 'Close tab', () => dropTab(t.id)),
                        'Close tab',
                        chordFor('closeTab')
                    )
                );
                r.addEventListener('click', () => showTab(t.id));
                tabList.appendChild(ui.hoverable(r, () => t === current));
            }
        };
        ui.contextMenu(tabList, {
            rowAt: (el) => el.closest?.('[data-tab-id]') || null,
            items: (r) => {
                const t = r && tabs.find((x) => String(x.id) === r.dataset.tabId);
                return t
                    ? [
                          { label: 'Close Tab', icon: 'x', run: () => dropTab(t.id) },
                          // All at once: closing them one by one would bring each neighbour forward on the way.
                          {
                              label: 'Close Other Tabs',
                              disabled: tabs.length < 2,
                              run: () => {
                                  tabs.forEach((o, at) => {
                                      if (o !== t) closedTabs.push({ here: o.here, at, widths: o.widths });
                                  });
                                  closedTabs.splice(0, Math.max(0, closedTabs.length - TABS_CLOSED_KEEP));
                                  tabs.splice(0, tabs.length, t);
                                  if (t !== current) showTab(t.id);
                                  else persistTabs();
                              },
                          },
                          '-',
                          {
                              label: 'Add to Favorites',
                              icon: 'star',
                              disabled: favorites().includes(t.here),
                              run: () => addFavorite(t.here),
                          },
                          { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(t.here) },
                      ]
                    : null;
            },
        });
        const renderPlaces = () => ui.whenFree(favList, drawPlaces);
        const drawPlaces = () => {
            favList.textContent = '';
            for (const p of favorites()) {
                const place = placeOf(p);
                const r = folderRow(
                    place ? PLACE_ICON[place.id] || 'folder' : 'folder',
                    place ? place.label : nameOf(p),
                    tilde(p)
                );
                r.appendChild(
                    ui.miniBtn(ui.icon('x', 14), 'Remove from Favorites', () =>
                        ui.leaveRow(r, () => setFavorites(favorites().filter((x) => x !== p)))
                    )
                );
                r.dataset.path = p;
                r.addEventListener('click', (ev) => {
                    host.show();
                    if (ev.metaKey) newTab(p);
                    else go(p);
                });
                favList.appendChild(ui.hoverable(r, () => p === hereNow()));
            }
            paintPlaces();
        };
        ui.contextMenu(favList, {
            rowAt: (el) => el.closest?.('[data-path]') || null,
            items: (r) => {
                const p = r?.dataset.path;
                return p
                    ? [
                          { label: 'Open in New Tab', icon: 'window', hint: '\u2318', run: () => newTab(p) },
                          { label: 'Show in Finder', icon: 'folder', run: () => host.reveal(p) },
                          '-',
                          {
                              label: 'Remove from Favorites',
                              icon: 'x',
                              run: () => setFavorites(favorites().filter((x) => x !== p)),
                          },
                          ...(missingPlaces().length
                              ? [
                                    {
                                        label: 'Restore System Places',
                                        icon: 'reload',
                                        run: () =>
                                            setFavorites([...missingPlaces().map((x) => x.path), ...favorites()]),
                                    },
                                ]
                              : []),
                      ]
                    : null;
            },
        });
        // Repainted in place: rebuilding the rows would drop a hover, a drag or a row on its way out.
        const paintPlaces = () => {
            paintStar();
            for (const r of favList.children) r.repaint?.();
        };
        data.on('sidebar', () => renderPlaces());

        settings.on((key) => {
            if (key === 'showHidden' || key === 'foldersFirst') render();
        });

        const setView = (next) => {
            if (next === view) return;
            view = next;
            store.set('view', view);
            viewBar.setIcon(viewGlyph());
            listEl.textContent = '';
            render();
            watchShown();
            listEl.focus({ preventScroll: true });
        };

        main.call('places')
            .then(async (got) => {
                home = got.home;
                places = got.places;
                renderPlaces();
                const list = Array.isArray(saved?.list) ? saved.list : [];
                const alive = []; // from: its index in the saved list
                for (const [i, t] of list.entries()) {
                    if (!t || typeof t.here !== 'string') continue;
                    // Only a folder known to be gone drops its tab: a failed check must not shorten what was left open.
                    const what = await main.call('exists', t.here).catch(() => 'unknown');
                    if (what === 'folder' || what === 'unknown')
                        alive.push({ here: t.here, widths: t.widths, from: i });
                }
                if (!alive.length) alive.push({ here: home, from: 0 });
                const ids = alive.map((t) => newTab(t.here, { background: true, widths: t.widths }));
                // The tab that was in front, or if it is gone the one before it, where closing it would have landed.
                const was = saved?.active | 0;
                let pick = alive.findIndex((t) => t.from === was);
                if (pick < 0) pick = Math.max(0, alive.map((t) => t.from < was).lastIndexOf(true));
                showTab(ids[pick]);
            })
            .catch((e) => {
                startFailure = { title: 'Could not start', hint: String(e?.message || e), permission: false };
                render();
            });

        const placeById = (id) => places.find((p) => p.id === id)?.path;
        return {
            content,
            sidebar,
            didAppear: () => {
                showing = true;
                if (current) {
                    watchShown();
                    load();
                }
                listEl.focus();
            },
            didDisappear: () => {
                showing = false;
                main.call('closeQuickLook').catch(() => {});
                watchShown();
            },

            keys: {
                newTab: { key: 'mod+t', label: 'New tab', run: () => newTab() },
                closeTab: {
                    key: 'mod+w',
                    label: 'Close tab',
                    run: () => {
                        if (current) dropTab(current.id);
                    },
                },
                reopenTab: { key: 'mod+shift+t', label: 'Reopen closed tab', run: reopenTab },
                ...Object.fromEntries(
                    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [
                        `tab${n}`,
                        {
                            key: `mod+${n}`,
                            label: `Tab ${n}`,
                            run: () => {
                                const t = tabs[n - 1];
                                if (t) showTab(t.id);
                            },
                        },
                    ])
                ),
                lastTab: {
                    key: 'mod+9',
                    label: 'Last tab',
                    run: () => {
                        const t = tabs[tabs.length - 1];
                        if (t) showTab(t.id);
                    },
                },
                back: { key: 'mod+[', label: 'Back', run: () => goBack() },
                forward: { key: 'mod+]', label: 'Forward', run: () => goAhead() },
                enclosing: { key: 'mod+up', label: 'Enclosing folder', run: () => goUp() },
                open: { key: 'mod+down', label: 'Open', run: () => openEntry(entryOf(current?.selected)) },
                filter: { key: 'mod+f', label: 'Filter this folder', run: () => search.input.focus() },
                home: { key: 'mod+shift+h', label: 'Go to Home', run: () => go(home) },
                desktop: { key: 'mod+shift+d', label: 'Go to Desktop', run: () => go(placeById('desktop')) },
                downloads: { key: 'mod+alt+l', label: 'Go to Downloads', run: () => go(placeById('downloads')) },
                applications: {
                    key: 'mod+shift+a',
                    label: 'Go to Applications',
                    run: () => go(placeById('applications')),
                },
                hidden: {
                    key: 'mod+shift+.',
                    label: 'Show hidden files',
                    run: () => settings.set('showHidden', !showHidden()),
                },
                newFolder: { key: 'mod+shift+n', label: 'New folder', run: () => newFolder() },
                // Finder's ⌘1 and ⌘2 for views are tabs here, so ⌃ is added.
                columnView: { key: 'ctrl+mod+1', label: 'As columns', run: () => setView('columns') },
                listView: { key: 'ctrl+mod+2', label: 'As list', run: () => setView('list') },
                trash: {
                    key: 'mod+backspace',
                    label: 'Move to Trash',
                    run: () => trashEntry(entryOf(current?.selected)),
                },
            },

            commands: () => [
                ...places.map((p) => ({
                    label: p.label,
                    hint: tilde(p.path),
                    icon: ui.icon(PLACE_ICON[p.id] || 'folder', 16),
                    keywords: ['폴더', 'folder'],
                    address: p.path,
                    run: () => {
                        host.show();
                        go(p.path);
                    },
                })),
                ...favorites()
                    .filter((p) => !placeOf(p))
                    .map((p) => ({
                        label: nameOf(p),
                        hint: tilde(p),
                        icon: ui.icon('folder', 16),
                        keywords: ['폴더', 'folder'],
                        address: p,
                        run: () => {
                            host.show();
                            go(p);
                        },
                    })),
            ],
        };
    },
});
