DeckitModule.define('deckit/ui/component/menu', { uses: ['deckit/ui/token'], provides: ['make'] }, (T) => {
    const { MOTION, Z, icon, pressable } = T;

    return {
        make: (theme, ui, inner) => {
            const { QUIET, DISABLED } = inner;
            // The menu open under each anchor, for menu() to close it on a second press.
            const openUnder = new WeakMap();
            const menuBox = () => {
                const box = document.createElement('div');
                Object.assign(box.style, {
                    position: 'fixed',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    padding: '4px',
                    borderRadius: '9px',
                    border: theme.border,
                    background: T.blend(theme.contentColor, theme.contentBg, 0.06),
                    boxShadow: '0 10px 32px rgba(0,0,0,.32)',
                    color: theme.contentColor,
                    font: '12.5px ' + theme.font,
                });
                return box;
            };
            const menuLine = () => {
                const line = document.createElement('div');
                Object.assign(line.style, { height: '1px', margin: '4px 6px', background: 'rgba(128,128,128,.22)' });
                return line;
            };
            const menuRow = (it, ticks) => {
                const r = document.createElement('div');
                Object.assign(r.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    height: '26px',
                    padding: ticks ? '0 12px 0 6px' : '0 12px 0 8px',
                    borderRadius: '6px',
                    cursor: it.disabled ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    color: it.disabled ? DISABLED : 'inherit',
                });
                if (ticks) {
                    const tick = document.createElement('span');
                    Object.assign(tick.style, {
                        display: 'flex',
                        flex: '0 0 14px',
                        color: T.ACCENT,
                        visibility: it.checked ? 'visible' : 'hidden',
                    });
                    tick.innerHTML = icon('check', 13);
                    r.appendChild(tick);
                }
                if (it.icon) {
                    const g = document.createElement('span');
                    Object.assign(g.style, { display: 'flex', flex: '0 0 auto', color: QUIET });
                    g.innerHTML = /^\s*<svg/.test(it.icon) ? it.icon : icon(it.icon, 14);
                    r.appendChild(g);
                }
                const text = document.createElement('span');
                text.textContent = it.label;
                Object.assign(text.style, { flex: '1 1 auto' });
                if (it.font) text.style.fontFamily = it.font;
                r.appendChild(text);
                if (it.items) {
                    const more = document.createElement('span');
                    Object.assign(more.style, {
                        display: 'flex',
                        flex: '0 0 auto',
                        marginLeft: '16px',
                        marginRight: '-6px',
                        color: QUIET,
                    });
                    more.innerHTML = icon('chevronRight', 13);
                    r.appendChild(more);
                } else if (it.hint) {
                    const h = document.createElement('span');
                    h.textContent = it.hint;
                    Object.assign(h.style, { flex: '0 0 auto', marginLeft: '16px', color: QUIET });
                    r.appendChild(h);
                }
                return r;
            };

            /* `beside`: the row a submenu opens from. `done`: called when an item is taken anywhere in it,
       to close what this menu hangs from. */
            const popMenu = ({
                items: given,
                anchor = null,
                at = null,
                beside = null,
                current = -1,
                minWidth = 0,
                onClose,
                done = null,
            }) => {
                // A line at either end, or two in a row, is not drawn.
                const items = given.filter(
                    (it, i, all) =>
                        it !== '-' ||
                        (i > 0 && i < all.length - 1 && all[i + 1] !== '-' && all.slice(0, i).some((x) => x !== '-'))
                );
                const menu = menuBox();
                Object.assign(menu.style, { minWidth: Math.max(minWidth, 160) + 'px', opacity: '0' });
                const ticks = items.some((it) => it !== '-' && typeof it.checked === 'boolean');
                const rows = [];
                for (const it of items) {
                    if (it === '-') {
                        menu.appendChild(menuLine());
                        continue;
                    }
                    const r = menuRow(it, ticks);
                    const i = rows.length;
                    rows.push({ el: r, it });
                    // On the press, so whatever had the focus does not take the click away first.
                    r.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        take(i, { keyboard: false });
                    });
                    menu.appendChild(r);
                }

                // The submenu open beside one row, if any, and the timer that opens or closes one on pointing.
                let sub = null,
                    subTimer = 0;
                const closeSub = () => {
                    clearTimeout(subTimer);
                    if (sub) {
                        const s = sub;
                        sub = null;
                        s.menu.close();
                    }
                };
                const openSub = (i, keyboard) => {
                    clearTimeout(subTimer);
                    if (sub?.i === i) return;
                    closeSub();
                    const row = rows[i];
                    if (!row?.it.items || row.it.disabled) return;
                    const child = popMenu({
                        items: row.it.items,
                        beside: row.el,
                        current: keyboard ? 0 : -1,
                        done: () => {
                            close();
                            done?.();
                        },
                        onClose: () => {
                            if (sub?.menu === child) sub = null;
                        },
                    });
                    sub = { i, menu: child };
                    // Reaching the submenu keeps it: crossing a row on the way there had set it to close.
                    child.el.addEventListener('mouseenter', () => clearTimeout(subTimer));
                };

                // Opened at the pointer, its first row is under the mouse before anyone has pointed at it.
                T.aimOnMove(menu, (e) => {
                    const i = rows.findIndex((row) => row.el.contains(e.target));
                    if (i < 0 || rows[i].it.disabled) return;
                    if (i !== at_) {
                        at_ = i;
                        paint();
                    }
                    clearTimeout(subTimer);
                    if (rows[i].it.items) subTimer = setTimeout(() => openSub(i, false), 120);
                    else if (sub) subTimer = setTimeout(closeSub, 200);
                });
                let at_ = rows[current] && !rows[current].it.disabled ? current : -1;
                const paint = () => {
                    rows.forEach((row, i) => {
                        row.el.style.background = i === at_ ? T.WASH.cursor : 'transparent';
                    });
                    rows[at_]?.el.scrollIntoView({ block: 'nearest' });
                };
                let open = true;
                // A press on this menu, or on what it hangs from, is this menu's; any other closes it (token.js).
                const layer = T.raise({
                    close: () => close(),
                    contains: (t) =>
                        menu.contains(t) || !!(anchor && anchor.contains(t)) || !!(beside && beside.contains(t)),
                });
                menu.style.zIndex = String(layer.z);
                const close = () => {
                    if (!open) return;
                    open = false;
                    closeSub();
                    layer.drop();
                    window.removeEventListener('scroll', scrolled, true);
                    window.removeEventListener('keydown', keys, true);
                    window.removeEventListener('resize', close);
                    window.removeEventListener('blur', close);
                    Object.assign(menu.style, {
                        transition: `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.fast} ${MOTION.ease}`,
                        opacity: '0',
                        transform: menu.dataset.shut,
                    });
                    setTimeout(() => menu.remove(), parseFloat(MOTION.fast) || 0);
                    onClose?.();
                };
                const take = (i, { keyboard }) => {
                    const row = rows[i];
                    if (!open || !row || row.it.disabled) return;
                    if (row.it.items) {
                        openSub(i, keyboard);
                        return;
                    }
                    close();
                    done?.();
                    row.it.run?.();
                };
                // Fixed where it was opened; once the page under it moves it points at nothing.
                const scrolled = (e) => {
                    if (!menu.contains(e.target) && !(sub && sub.menu.el.contains(e.target))) close();
                };
                // The next item that can be taken, or none (-1) when every item is disabled.
                const step = (by) => {
                    let i = at_;
                    for (let n = 0; n < rows.length; n++) {
                        i = i < 0 ? (by > 0 ? 0 : rows.length - 1) : (i + by + rows.length) % rows.length;
                        if (!rows[i].it.disabled) {
                            at_ = i;
                            paint();
                            return;
                        }
                    }
                    at_ = -1;
                    paint();
                };
                const keys = (e) => {
                    // Something opened over the menu (its submenu, a dialog an item asked for) has the keyboard now.
                    if (!layer.isTop()) return;
                    if (e.key === 'ArrowDown') step(1);
                    else if (e.key === 'ArrowUp') step(-1);
                    else if (e.key === 'ArrowRight' && rows[at_]?.it.items) openSub(at_, true);
                    else if (e.key === 'ArrowLeft' && beside) close();
                    else if (e.key === 'Enter' || e.key === ' ') take(at_, { keyboard: true });
                    else if (e.key === 'Escape' || e.key === 'Tab') close();
                    else return;
                    e.preventDefault();
                    e.stopPropagation();
                };
                document.body.appendChild(menu);

                // A submenu overlaps the menu it opens from and casts a deeper shadow, so it reads as laid on top.
                if (beside) menu.style.boxShadow = '0 14px 40px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.28)';
                const w = menu.offsetWidth,
                    h = menu.offsetHeight;
                let x,
                    y,
                    up = false,
                    left = false;
                if (beside) {
                    const b = beside.getBoundingClientRect(),
                        from = beside.parentElement.getBoundingClientRect();
                    const OVER = 6;
                    x = from.right - OVER;
                    if (x + w > window.innerWidth - 8) {
                        x = from.left + OVER - w;
                        left = true;
                    }
                    y = b.top - 4;
                    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - 8 - h);
                } else if (anchor) {
                    const b = anchor.getBoundingClientRect();
                    x = b.left;
                    up = b.bottom + 4 + h > window.innerHeight - 8 && b.top - 4 - h >= 8;
                    // An anchor as tall as the screen (a whole list) leaves no room either side: kept on screen.
                    y = Math.max(8, Math.min(up ? b.top - 4 - h : b.bottom + 4, window.innerHeight - 8 - h));
                } else {
                    x = at.x;
                    y = at.y;
                    if (y + h > window.innerHeight - 8) {
                        y = Math.max(8, at.y - h);
                        up = true;
                    }
                }
                menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
                menu.style.top = y + 'px';
                // Grows out of the edge, or for a submenu the side, it hangs from.
                if (beside) {
                    menu.style.transformOrigin = 'top ' + (left ? 'right' : 'left');
                    menu.dataset.shut = (left ? 'translateX(6px)' : 'translateX(-6px)') + ' scale(.96)';
                } else {
                    menu.style.transformOrigin = (up ? 'bottom' : 'top') + ' left';
                    menu.dataset.shut = up ? 'translateY(6px) scale(.96)' : 'translateY(-6px) scale(.96)';
                }
                T.play(
                    menu,
                    { transform: menu.dataset.shut },
                    {
                        transition: `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.base} ${MOTION.ease}`,
                        opacity: '1',
                        transform: 'none',
                    }
                );
                paint();

                // Next tick: the press or key that opened it must not be the one that closes it.
                setTimeout(() => {
                    if (!open) return;
                    window.addEventListener('scroll', scrolled, true);
                    window.addEventListener('keydown', keys, true);
                    window.addEventListener('resize', close);
                    window.addEventListener('blur', close);
                }, 0);
                return {
                    close,
                    get open() {
                        return open;
                    },
                    el: menu,
                };
            };

            // inlineEdit says why a rename was refused, under the field, in the same box.
            inner.menuBox = menuBox;

            return {
                /* Under an anchor, one at a time: the press on the anchor is the menu's own, so nothing else
         would close the first. */
                menu(items, { at = null, anchor = null, onClose } = {}) {
                    const open = anchor && openUnder.get(anchor);
                    if (open?.open) {
                        open.close();
                        return null;
                    }
                    const m = popMenu({
                        items,
                        at,
                        anchor,
                        onClose: () => {
                            if (anchor && openUnder.get(anchor) === m) openUnder.delete(anchor);
                            onClose?.();
                        },
                    });
                    if (anchor) openUnder.set(anchor, m);
                    return m;
                },
                select(options, { value = null, onChange } = {}) {
                    let current = value;
                    const box = document.createElement('button');
                    box.type = 'button';
                    Object.assign(box.style, {
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flex: '0 0 auto',
                        height: '26px',
                        border: '0',
                        outline: 'none',
                        borderRadius: '999px',
                        background: T.WASH.hover,
                        padding: '0 8px 0 12px',
                        cursor: 'pointer',
                        maxWidth: '240px',
                        color: theme.contentColor,
                        font: '12.5px ' + theme.font,
                    });
                    const label = document.createElement('span');
                    Object.assign(label.style, {
                        flex: '0 1 auto',
                        minWidth: '0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    });
                    const caret = document.createElement('span');
                    caret.innerHTML = icon('chevronDown', 13);
                    Object.assign(caret.style, {
                        display: 'flex',
                        flex: '0 0 auto',
                        color: QUIET,
                        transition: `transform ${MOTION.fast} ${MOTION.ease}`,
                    });
                    box.append(label, caret);
                    const show = () => {
                        const o = options.find((x) => x.value === current);
                        label.textContent = o ? o.label : '';
                        label.style.fontFamily = o?.font || '';
                    };
                    show();

                    let menu = null;
                    const open = () => {
                        if (menu?.open) return;
                        caret.style.transform = 'rotate(180deg)';
                        menu = popMenu({
                            anchor: box,
                            minWidth: box.getBoundingClientRect().width,
                            current: Math.max(
                                0,
                                options.findIndex((o) => o.value === current)
                            ),
                            items: options.map((o) => ({
                                label: o.label,
                                font: o.font,
                                checked: o.value === current,
                                run: () => {
                                    if (o.value === current) return;
                                    current = o.value;
                                    show();
                                    onChange?.(o.value);
                                },
                            })),
                            onClose: () => {
                                caret.style.transform = 'none';
                                menu = null;
                            },
                        });
                    };
                    // Not pressable(): the pill rests on a grey of its own, a step darker under the pointer.
                    box.addEventListener('mouseenter', () => {
                        box.style.background = T.WASH.cursor;
                    });
                    box.addEventListener('mouseleave', () => {
                        box.style.background = T.WASH.hover;
                    });
                    box.addEventListener('focus', () => {
                        if (box.matches(':focus-visible')) box.style.boxShadow = '0 0 0 2px ' + T.FOCUS_RING;
                    });
                    box.addEventListener('blur', () => {
                        box.style.boxShadow = 'none';
                    });
                    box.addEventListener('click', () => (menu ? menu.close() : open()));
                    box.addEventListener('keydown', (e) => {
                        if (menu) return; // the menu has the keyboard while it is open
                        if ([' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                            e.preventDefault();
                            open();
                        }
                    });
                    Object.defineProperty(box, 'value', {
                        get: () => current,
                        set: (v) => {
                            current = v;
                            show();
                        },
                    });
                    return box;
                },
                contextMenu(area, { rowAt, items, keyRow = () => rowAt(document.activeElement) }) {
                    let showing = null;
                    const show = (row, where) => {
                        if (showing?.open) {
                            showing.close();
                            return true;
                        }
                        const list = items(row);
                        if (!list || !list.length) return false;
                        let kept = null;
                        if (row) {
                            kept = row.style.boxShadow;
                            const ring = `inset 0 0 0 2px ${T.alpha(T.ACCENT, 0.75)}`;
                            row.style.boxShadow = kept && kept !== 'none' ? `${ring}, ${kept}` : ring;
                        }
                        showing = popMenu({
                            items: list,
                            ...where,
                            onClose: () => {
                                if (row) row.style.boxShadow = kept;
                            },
                        });
                        return true;
                    };
                    area.addEventListener('contextmenu', (e) => {
                        if (show(rowAt(e.target), { at: { x: e.clientX, y: e.clientY } })) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    });
                    area.addEventListener('keydown', (e) => {
                        if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return;
                        const row = keyRow();
                        const box = area.getBoundingClientRect();
                        if (show(row, row ? { anchor: row } : { at: { x: box.left + 12, y: box.top + 12 } })) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    });
                    return area;
                },
                floatingBar() {
                    const bar = menuBox();
                    Object.assign(bar.style, {
                        display: 'none',
                        zIndex: String(Z.popover),
                        padding: '3px',
                        gap: '1px',
                        alignItems: 'center',
                        maxHeight: 'none',
                        overflowY: 'visible',
                    });
                    bar.addEventListener('mousedown', (e) => e.preventDefault());
                    document.body.appendChild(bar);
                    return bar;
                },
                // In the page only while open: left in it, it would keep alive whatever its rows' handlers hold.
                suggestions({ onPick }) {
                    const box = menuBox();
                    Object.assign(box.style, { minWidth: '220px', zIndex: String(Z.popover) });
                    // Pressing it anywhere, a row or the space between, never takes the keyboard from the text.
                    box.addEventListener('mousedown', (e) => e.preventDefault());
                    let list = [],
                        rows = [],
                        at = 0,
                        open = false;
                    const paint = () => {
                        rows.forEach((r, i) => {
                            r.style.background = i === at ? T.WASH.cursor : 'transparent';
                        });
                        rows[at]?.scrollIntoView({ block: 'nearest' });
                    };
                    T.aimOnMove(box, (e) => {
                        const i = rows.findIndex((r) => r.contains(e.target));
                        if (i >= 0 && i !== at) {
                            at = i;
                            paint();
                        }
                    });
                    const place = (rect) => {
                        if (!open || !rect) return;
                        const h = box.offsetHeight,
                            w = box.offsetWidth;
                        const below = rect.bottom + 6 + h < window.innerHeight - 8;
                        box.style.top = (below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - h)) + 'px';
                        box.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) + 'px';
                    };
                    const close = () => {
                        open = false;
                        at = 0;
                        list = [];
                        rows = [];
                        box.textContent = '';
                        box.remove();
                    };
                    const take = (i = at) => {
                        const it = list[i];
                        if (!it) return;
                        close();
                        onPick(it);
                    };
                    const show = (items, rect) => {
                        list = items;
                        at = Math.min(at, Math.max(0, items.length - 1));
                        box.textContent = '';
                        rows = items.map((it, i) => {
                            const r = menuRow(it, false);
                            r.addEventListener('mousedown', () => take(i));
                            box.appendChild(r);
                            return r;
                        });
                        open = true;
                        // In the page before it is placed: placing reads its size.
                        if (!box.isConnected) document.body.appendChild(box);
                        paint();
                        place(rect);
                    };
                    const step = (by) => {
                        if (list.length) {
                            at = (at + by + list.length) % list.length;
                            paint();
                        }
                    };
                    return {
                        show,
                        place,
                        step,
                        take,
                        close,
                        get open() {
                            return open;
                        },
                    };
                },
            };
        },
    };
});
