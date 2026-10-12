DeckitModule.define(
    'deckit/ui/component/menu',
    { uses: ['deckit/ui/icon', 'deckit/ui/overlay', 'deckit/ui/list/listbox'], provides: ['STYLE', 'make'] },
    (ICON, OVERLAY, LISTBOX) => {
        // MARK: - Property
        const STYLE = `
            .deckit-menu {
                position: fixed;
                box-sizing: border-box;
                max-height: 320px;
                overflow-y: auto;
                padding: 4px;
                border-radius: var(--deckit-radius-large);
                border: var(--deckit-border);
                background: var(--deckit-surface);
                box-shadow: var(--deckit-shadow-raised);
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
            .deckit-menu[data-nested] { box-shadow: var(--deckit-shadow-nested); }
            .deckit-menu-separator { height: 1px; margin: 4px 6px; background: var(--deckit-divider); }
            .deckit-menu-row {
                display: flex;
                align-items: center;
                gap: 7px;
                height: 26px;
                padding: 0 12px 0 8px;
                border-radius: var(--deckit-radius-control);
                cursor: pointer;
                white-space: nowrap;
            }
            .deckit-menu-row[data-ticks] { padding-left: 6px; }
            .deckit-menu-row[data-active] { background: var(--deckit-selected); }
            .deckit-menu-row[aria-disabled='true'] { color: var(--deckit-disabled); cursor: default; }
            .deckit-menu-tick { display: flex; flex: 0 0 14px; color: var(--deckit-accent); }
            .deckit-menu-row:not([aria-checked='true']) .deckit-menu-tick { visibility: hidden; }
            .deckit-menu-icon { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
            .deckit-menu-label { flex: 1 1 auto; }
            .deckit-menu-more { display: flex; flex: 0 0 auto; margin: 0 -6px 0 16px; color: var(--deckit-muted); }
            .deckit-menu-hint { flex: 0 0 auto; margin-left: 16px; color: var(--deckit-muted); }
            .deckit-toolbar { display: none; gap: 1px; align-items: center; padding: 3px; max-height: none; overflow: visible; }
            .deckit-select {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 0 0 auto;
                max-width: 240px;
                height: 26px;
                padding: 0 8px 0 12px;
                border: 0;
                outline: none;
                border-radius: var(--deckit-radius-round);
                background: var(--deckit-fill);
                color: var(--deckit-text);
                font: var(--deckit-type-body);
                cursor: pointer;
            }
            .deckit-select:hover { background: var(--deckit-selected); }
            .deckit-select:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-select-label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .deckit-select-caret {
                display: flex;
                flex: 0 0 auto;
                color: var(--deckit-muted);
                transition: transform var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-select[aria-expanded='true'] .deckit-select-caret { transform: rotate(180deg); }
            [data-deckit-target] { outline: 2px solid var(--deckit-target); outline-offset: -2px; }
        `;
        // How long the pointer rests on a row before its submenu opens, and on another row before it closes.
        const SUBMENU_OPEN_MS = 120;
        const SUBMENU_CLOSE_MS = 200;
        const WIDTH_MIN = 160;
        const openUnder = new WeakMap(); // anchor -> the menu open under it

        // MARK: - Initializer
        // MARK: - Public
        function make() {
            return { menu, select, contextMenu, floatingToolbar, autocomplete };
        }

        // MARK: - Private
        // A menu under an anchor or at a point. Under an anchor one at a time: the press on the anchor is the menu's own,
        // so nothing else would close it, and a second press closes it and returns null.
        function menu({ items, anchor = null, point = null, onClose }) {
            const open = anchor && openUnder.get(anchor);
            if (open?.isOpen()) {
                open.close();
                return null;
            }
            const shown = popMenu({
                items,
                point,
                anchor,
                onClose: () => {
                    if (anchor && openUnder.get(anchor) === shown) openUnder.delete(anchor);
                    onClose?.();
                },
            });
            if (anchor) openUnder.set(anchor, shown);
            return shown;
        }

        // One of `options` ({ value, label, font }), chosen from a menu. A choice is reported; the owner sets it.
        function select({ options, value = null, onChange }) {
            let current = value;
            let shown = null;
            const element = tag('button', 'deckit-select');
            element.type = 'button';
            element.setAttribute('aria-haspopup', 'listbox');
            element.setAttribute('aria-expanded', 'false');
            const label = tag('span', 'deckit-select-label');
            const caret = tag('span', 'deckit-select-caret');
            caret.innerHTML = ICON.icon('chevronDown', { size: 13 });
            element.append(label, caret);
            const set = (next) => {
                current = next;
                const option = options.find((candidate) => candidate.value === current);
                label.textContent = option ? option.label : '';
                label.style.fontFamily = option?.font || '';
            };
            const open = () => {
                element.setAttribute('aria-expanded', 'true');
                shown = popMenu({
                    anchor: element,
                    minWidth: element.getBoundingClientRect().width,
                    active: Math.max(
                        0,
                        options.findIndex((option) => option.value === current)
                    ),
                    items: options.map((option) => ({
                        label: option.label,
                        font: option.font,
                        checked: option.value === current,
                        run: () => option.value !== current && onChange?.(option.value),
                    })),
                    onClose: () => {
                        element.setAttribute('aria-expanded', 'false');
                        shown = null;
                    },
                });
            };
            element.addEventListener('click', () => (shown ? shown.close() : open()));
            element.addEventListener('keydown', (event) => {
                if (shown || ![' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                open();
            });
            set(current);
            return { element, set };
        }

        // The menu of a row of `area`, opened by the context click, or by the ContextMenu key or Shift+F10 on the row
        // with the focus. The row it is about is marked while it is open.
        function contextMenu(area, { rowAt, items, keyRow = () => rowAt(document.activeElement) }) {
            let shown = null;
            const show = (row, where) => {
                if (shown?.isOpen()) {
                    shown.close();
                    return true;
                }
                const list = items(row);
                if (!list?.length) return false;
                row?.setAttribute('data-deckit-target', '');
                shown = popMenu({ items: list, ...where, onClose: () => row?.removeAttribute('data-deckit-target') });
                return true;
            };
            const onContext = (event) => {
                if (!show(rowAt(event.target), { point: { x: event.clientX, y: event.clientY } })) return;
                event.preventDefault();
                event.stopPropagation();
            };
            const onKey = (event) => {
                if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
                const row = keyRow();
                const box = area.getBoundingClientRect();
                if (!show(row, row ? { anchor: row } : { point: { x: box.left + 12, y: box.top + 12 } })) return;
                event.preventDefault();
                event.stopPropagation();
            };
            area.addEventListener('contextmenu', onContext);
            area.addEventListener('keydown', onKey);
            return () => {
                area.removeEventListener('contextmenu', onContext);
                area.removeEventListener('keydown', onKey);
            };
        }

        // A bar over what its owner acts on: `show(rect)` puts it centred above the rect, or below when only that fits.
        // A press on it never takes the focus from the text it acts on.
        function floatingToolbar() {
            const element = tag('div', 'deckit-menu deckit-toolbar');
            element.style.zIndex = String(OVERLAY.Z.float);
            element.addEventListener('mousedown', (event) => event.preventDefault());
            document.body.append(element);
            return {
                element,
                show: (rect) => {
                    element.style.display = 'flex';
                    OVERLAY.place(element, { rect, gap: 8, align: 'center', prefer: 'top' });
                },
                hide: () => (element.style.display = 'none'),
            };
        }

        // Candidates under a text its owner edits: the owner moves through them with its own keys. In the page only
        // while open: left in it, it would keep alive whatever its rows hold.
        function autocomplete({ onPick }) {
            const box = tag('div', 'deckit-menu');
            Object.assign(box.style, { minWidth: '220px', zIndex: String(OVERLAY.Z.float) });
            box.addEventListener('mousedown', (event) => event.preventDefault());
            let items = [];
            let open = false;
            const list = LISTBOX.listbox(box, { onPick: (index) => pick(index) });
            const place = (rect) => open && rect && OVERLAY.place(box, { rect, gap: 6 });
            const close = () => {
                open = false;
                items = [];
                list.set([]);
                box.replaceChildren();
                box.remove();
            };
            const pick = (index = list.active()) => {
                const item = items[index];
                if (!item) return;
                close();
                onPick(item);
            };
            const show = (next, rect) => {
                items = next;
                const rows = items.map((item) => rowOf(item, false));
                box.replaceChildren(...rows);
                list.set(
                    rows.map((row) => ({ element: row, disabled: false })),
                    { active: Math.max(0, list.active()) }
                );
                open = true;
                if (!box.isConnected) document.body.append(box);
                place(rect);
            };
            return { show, place, move: (by) => list.move(by), pick: () => pick(), close, isOpen: () => open };
        }

        // A menu on the overlay. `beside` is the row a submenu opens from; `done` runs when an item is taken anywhere in
        // it, to close the menus it hangs from.
        function popMenu({
            items,
            anchor = null,
            point = null,
            beside = null,
            active = -1,
            minWidth = 0,
            onClose,
            done,
        }) {
            const box = tag('div', 'deckit-menu');
            box.setAttribute('role', 'menu');
            box.style.minWidth = Math.max(minWidth, WIDTH_MIN) + 'px';
            if (beside) box.dataset.nested = '';
            const shown = withoutStraySeparators(items);
            const ticks = shown.some((item) => item !== '-' && typeof item.checked === 'boolean');
            const options = [];
            for (const item of shown) {
                if (item === '-') {
                    box.append(tag('div', 'deckit-menu-separator'));
                    continue;
                }
                const row = rowOf(item, ticks);
                options.push({ element: row, disabled: !!item.disabled, item });
                box.append(row);
            }
            let open = true;
            let submenu = null; // { index, menu }
            let timer = 0;
            const closeSubmenu = () => {
                clearTimeout(timer);
                const closing = submenu;
                submenu = null;
                closing?.menu.close();
            };
            const openSubmenu = (index, keyboard) => {
                clearTimeout(timer);
                if (submenu?.index === index) return;
                closeSubmenu();
                const { item, element: row } = options[index];
                if (!item.items || item.disabled) return;
                const child = popMenu({
                    items: item.items,
                    beside: row,
                    active: keyboard ? 0 : -1,
                    done: () => {
                        close();
                        done?.();
                    },
                    onClose: () => {
                        if (submenu?.menu === child) submenu = null;
                    },
                });
                submenu = { index, menu: child };
                // Reaching the submenu keeps it: crossing a row on the way there set it to close.
                child.element.addEventListener('mouseenter', () => clearTimeout(timer));
            };
            const close = () => {
                if (!open) return;
                open = false;
                closeSubmenu();
                layer.close();
                onClose?.();
            };
            const take = (index, keyboard) => {
                const { item } = options[index];
                if (item.items) return openSubmenu(index, keyboard);
                close();
                done?.();
                item.run?.();
            };
            const list = LISTBOX.listbox(box, {
                onPick: (index, { keyboard }) => take(index, keyboard),
                onActivate: (index, { pointer }) => {
                    if (!pointer) return;
                    clearTimeout(timer);
                    if (options[index].item.items) timer = setTimeout(() => openSubmenu(index, false), SUBMENU_OPEN_MS);
                    else if (submenu) timer = setTimeout(closeSubmenu, SUBMENU_CLOSE_MS);
                },
            });
            const onKey = (event) => {
                const index = list.active();
                if (event.key === 'ArrowDown') list.move(1);
                else if (event.key === 'ArrowUp') list.move(-1);
                else if (event.key === 'ArrowRight' && options[index]?.item.items) openSubmenu(index, true);
                else if (event.key === 'ArrowLeft' && beside) close();
                else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) take(index, true);
                else if (event.key === 'Tab') close();
                else return false;
                return true;
            };
            const layer = OVERLAY.open({
                element: box,
                anchor,
                point,
                beside,
                transient: true,
                onKey,
                onDismiss: close,
            });
            list.set(options, { active: options[active]?.disabled ? -1 : active });
            return { element: box, close, isOpen: () => open };
        }

        function rowOf(item, ticks) {
            const row = tag('div', 'deckit-menu-row');
            row.setAttribute('role', ticks ? 'menuitemcheckbox' : 'menuitem');
            if (ticks) {
                row.dataset.ticks = '';
                row.setAttribute('aria-checked', String(!!item.checked));
                const tick = tag('span', 'deckit-menu-tick');
                tick.innerHTML = ICON.icon('check', { size: 13 });
                row.append(tick);
            }
            if (item.disabled) row.setAttribute('aria-disabled', 'true');
            if (item.icon) {
                const glyph = tag('span', 'deckit-menu-icon');
                glyph.innerHTML = /^\s*<svg/.test(item.icon) ? item.icon : ICON.icon(item.icon, { size: 14 });
                row.append(glyph);
            }
            const label = tag('span', 'deckit-menu-label');
            label.textContent = item.label;
            if (item.font) label.style.fontFamily = item.font;
            row.append(label);
            if (item.items) {
                const more = tag('span', 'deckit-menu-more');
                more.innerHTML = ICON.icon('chevronRight', { size: 13 });
                row.append(more);
            } else if (item.hint) {
                const hint = tag('span', 'deckit-menu-hint');
                hint.textContent = item.hint;
                row.append(hint);
            }
            return row;
        }

        // A separator at either end, or next to another, is not drawn.
        function withoutStraySeparators(items) {
            const kept = [];
            for (const item of items) {
                if (item === '-' && (!kept.length || kept.at(-1) === '-')) continue;
                kept.push(item);
            }
            if (kept.at(-1) === '-') kept.pop();
            return kept;
        }

        function tag(name, className) {
            const made = document.createElement(name);
            made.className = className;
            return made;
        }

        return { STYLE, make };
    }
);
