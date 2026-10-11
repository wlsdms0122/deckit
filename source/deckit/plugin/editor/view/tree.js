const fileTree = ({ theme, ui, store, main, onOpen, onFindIn, onMove, marks, menu }) => {
    // Grown to fill, so a drop or a right click under the rows is the top folder's.
    const element = el('div', {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 auto',
        padding: '2px 0 8px',
        outline: 'none',
    });
    element.tabIndex = -1;

    let root = null;
    const children = new Map(); // folder path -> its entries, once read
    let expanded = new Set();
    let selected = null;
    let revealing = 0;
    // Bumping `revealing` makes a reveal still opening its folders leave the pick alone.
    const pick = (path) => {
        revealing++;
        selected = path;
    };
    const keyOf = () => 'expanded:' + root;
    const save = () => store.set(keyOf(), [...expanded]);

    const read = async (dir) => {
        try {
            children.set(dir, await main.call('list', dir));
        } catch (e) {
            children.set(dir, []);
            if (failureOf(e).kind === 'GONE' && expanded.delete(dir)) save();
        }
    };

    // Read again each time: what it held may have changed.
    const expand = async (dir) => {
        expanded.add(dir);
        await read(dir);
    };

    const entryAt = (path) => {
        for (const list of children.values()) {
            const e = list.find((x) => x.path === path);
            if (e) return e;
        }
        return null;
    };
    ui.contextMenu(element, {
        rowAt: (t) => t.closest?.('[data-path]') || null,
        items: (r) => {
            if (!menu || !root) return null;
            if (!r) return menu(null);
            const e = entryAt(r.dataset.path);
            return e ? menu(e) : null;
        },
    });

    const step = (path) => {
        pick(path);
        const entry = entryAt(path);
        if (entry && !entry.folder) onOpen(path, { preview: true, look: true });
        render();
        rowOf(path)?.scrollIntoView({ block: 'nearest' });
    };
    const setOpen = async (dir, open) => {
        if (open) await expand(dir);
        else expanded.delete(dir);
        save();
        render();
    };

    const row = (entry, depth) => {
        const open = entry.folder && expanded.has(entry.path);
        const r = ui.treeRow({
            depth,
            folder: entry.folder,
            open,
            glyph: entry.folder ? '' : fileIcons.file(entry.name, 14),
            name: entry.name,
            dense: true,
        });
        r.style.paddingRight = '8px';
        r.title = entry.path;
        r.dataset.path = entry.path;
        const mark = entry.folder ? marks.folder(entry.path) : marks.file(entry.path);
        if (mark.dirty)
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
        if (entry.folder && onFindIn) {
            r.appendChild(
                ui.miniBtn(ui.icon('search', 13), 'Find in this folder', () =>
                    onFindIn(entry.path.slice(root.length + 1))
                )
            );
        }
        const lit = entry.path === selected;
        ui.hoverable(r, () => lit);
        r.addEventListener('click', () => {
            element.focus({ preventScroll: true });
            if (!entry.folder) {
                step(entry.path);
                return;
            }
            pick(entry.path);
            setOpen(entry.path, !expanded.has(entry.path));
        });
        if (!entry.folder) r.addEventListener('dblclick', () => onOpen(entry.path, { preview: false }));
        return r;
    };

    // Only on the tree itself: a name being typed over in a row keeps its keys.
    element.addEventListener('keydown', (e) => {
        if (e.target !== element || e.metaKey || e.ctrlKey || e.altKey || !root) return;
        const entry = selected && entryAt(selected);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const paths = [...element.querySelectorAll('[data-path]')].map((r) => r.dataset.path);
            const at = paths.indexOf(selected);
            const next =
                at < 0
                    ? paths[0]
                    : paths[Math.min(paths.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))];
            if (next && next !== selected) step(next);
        } else if (e.key === 'ArrowRight' && entry?.folder) {
            e.preventDefault();
            if (expanded.has(entry.path)) {
                const first = children.get(entry.path)?.[0];
                if (first) step(first.path);
                return;
            }
            setOpen(entry.path, true);
        } else if (e.key === 'ArrowLeft' && entry) {
            e.preventDefault();
            if (entry.folder && expanded.has(entry.path)) {
                setOpen(entry.path, false);
                return;
            }
            const up = entry.path.slice(0, entry.path.lastIndexOf('/'));
            if (up.startsWith(root + '/')) step(up);
        } else if (e.key === ' ' && entry?.folder) {
            e.preventDefault(); // the sidebar does not scroll by a page
            setOpen(entry.path, !expanded.has(entry.path));
        }
    });

    if (onMove) {
        ui.dragSource(element, {
            itemAt: (t) => t.closest?.('[data-path]') || null,
            what: (r) => {
                const entry = entryAt(r.dataset.path);
                return (
                    entry && {
                        kind: 'editor-entry',
                        payload: entry,
                        text: entry.name,
                        icon: entry.folder ? ui.folderIcon(false, 14) : fileIcons.file(entry.name, 14),
                    }
                );
            },
        });
        const folderAt = (at) =>
            root &&
            ui.treeFolderAt({
                row: (t) => {
                    const r = t.closest?.('[data-path]');
                    const e = r && entryAt(r.dataset.path);
                    return e ? { path: e.path, folder: e.folder, el: r } : null;
                },
                markOf: (dir) => element.querySelector(`[data-path="${CSS.escape(dir)}"]`),
                top: root,
                topMark: element,
            })(at);
        ui.folderDrop(element, {
            kind: 'editor-entry',
            path: (held) => held.path,
            folderAt,
            onDrop: (held, place) => onMove(held, place.folder),
        });
    }

    const rowOf = (path) => element.querySelector(`[data-path="${CSS.escape(path)}"]`);

    // Through whenFree: a row being renamed or dragged keeps its place until it is done.
    const render = () => ui.whenFree(element, draw);
    const draw = () => {
        element.textContent = '';
        if (!root) return;
        const walk = (dir, depth) => {
            for (const entry of children.get(dir) || []) {
                element.appendChild(row(entry, depth));
                if (entry.folder && expanded.has(entry.path)) walk(entry.path, depth + 1);
            }
        };
        walk(root, 0);
        if (!(children.get(root) || []).length)
            element.appendChild(
                el('div', { padding: '4px 8px', opacity: '.4', font: '12.5px ' + theme.font }, 'Empty folder')
            );
    };

    const refresh = async () => {
        if (!root) return;
        const open = [root, ...[...expanded].filter((p) => p.startsWith(root + '/'))];
        await Promise.all(open.map(read));
        render();
    };

    const follow = (move) => {
        const next = root && move(root);
        expanded = new Set([...expanded].map(move).filter(Boolean));
        selected = selected && move(selected);
        if (next && next !== root) {
            store.remove(keyOf());
            root = next;
            children.clear();
        }
        save();
        return refresh();
    };

    const api = {
        element,
        async setRoot(path) {
            root = path;
            children.clear();
            selected = null;
            expanded = new Set((store.get('expanded:' + path, []) || []).filter((p) => typeof p === 'string'));
            await refresh();
        },
        refresh,
        repaint: render,
        // Scrolled to the middle only when out of sight: a row the eye can already see is found where it is.
        async reveal(path) {
            if (!root || !path.startsWith(root + '/')) return;
            const mine = ++revealing;
            const shown = rowOf(path);
            if (selected === path && shown && ui.inSight(shown)) return;
            const parts = path
                .slice(root.length + 1)
                .split('/')
                .slice(0, -1);
            let dir = root;
            for (const part of parts) {
                dir = dir + '/' + part;
                await expand(dir);
            }
            if (mine !== revealing) return render();
            selected = path;
            save();
            render();
            const r = rowOf(path);
            if (!r) return;
            if (!ui.inSight(r)) r.scrollIntoView({ block: 'center', behavior: 'smooth' });
        },
        focus() {
            element.focus({ preventScroll: true });
        },
        picked() {
            return element.contains(document.activeElement) && selected ? entryAt(selected) : null;
        },
        // The folder is read again first: the entry may be new.
        async nameAt(path) {
            await read(path.slice(0, path.lastIndexOf('/')));
            await api.reveal(path);
            return element.querySelector(`[data-path="${CSS.escape(path)}"] [data-name]`);
        },
        follow,
    };
    return api;
};
