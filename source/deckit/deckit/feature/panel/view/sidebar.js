DeckitModule.define(
    'deckit/feature/panel/view/sidebar',
    {
        uses: ['deckit/service/home/model/config', 'deckit/ui/token', 'deckit/ui/kit'],
        provides: ['make'],
    },
    (CONFIG, TOKEN, UI) => {
        const { MOTION, blend, scrollFade } = UI;
        const { isDark } = TOKEN;

        // A generous ceiling: in a window of its own the panel has room, and sidebar lists want width.
        const SIDEBAR_DEFAULT = 240,
            SIDEBAR_MIN = 240,
            SIDEBAR_MAX = 720;
        const NAV_MIN = 70,
            SLOT_MIN = 120;
        const STORE = CONFIG.id + ':';
        const WIDTH_KEY = STORE + 'sidebar-width';
        const COLLAPSED_KEY = STORE + 'sidebar-collapsed';
        const NAV_HEIGHT_KEY = STORE + 'nav-height';
        // The handle stands a little past the gap, over the content's edge: centred in the gap it read as part of the card.
        const INSET = 8,
            RADIUS = 12,
            HANDLE_OUT = 6;

        const rawLoad = (key, fallback) => {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch {
                return fallback;
            }
        };
        const rawSave = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {}
        };

        const make = ({ theme, ui, root, content, rows, onPick, onBack, onForward, onReorder, chordOf }) => {
            /* Two boxes: the outer one animates its width while the body keeps its own, so the sections inside
       do not reflow against their min-widths every frame. Padding is the body's, or the outer box
       would leave a 16px stub at a width of 0. */
            const startWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, rawLoad(WIDTH_KEY, SIDEBAR_DEFAULT)));

            /* Its ink is the content's, not the place's sidebar colour: that one is chosen against the
       place's own sidebar fill, and is white on a light theme. */
            const dark = isDark(theme.contentBg);
            const wash = (a) => (dark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
            const sidebar = document.createElement('div');
            sidebar.className = 'deckit__sidebar';
            Object.assign(sidebar.style, {
                width: startWidth + 'px',
                flex: '0 0 auto',
                background: `linear-gradient(180deg, ${wash(dark ? 0.045 : 0.03)}, ${wash(dark ? 0.025 : 0.015)})`,
                color: theme.contentColor,
                // Off the content as well as off the edges: a card touching the page beside it reads as a column.
                margin: INSET + 'px',
                borderRadius: RADIUS + 'px',
                border: `1px solid ${wash(dark ? 0.1 : 0.08)}`,
                boxShadow: dark
                    ? 'inset 0 1px 0 rgba(255,255,255,.09), 0 1px 2px rgba(0,0,0,.35), 0 10px 28px rgba(0,0,0,.32)'
                    : 'inset 0 1px 0 rgba(255,255,255,.8), 0 1px 2px rgba(0,0,0,.08), 0 10px 28px rgba(0,0,0,.10)',
                boxSizing: 'border-box',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '0',
                transition: `width ${MOTION.base} ${MOTION.ease}, margin ${MOTION.base} ${MOTION.ease}, opacity ${MOTION.base} ${MOTION.ease}`,
            });

            /* 5 at the top lines the heading up with a plugin's own header in the content column. The side
       gutter is inside each part that scrolls, so a scrollbar runs down the sidebar's edge, not 12px in. */
            const GUTTER = '12px';
            const sidebarBody = document.createElement('div');
            Object.assign(sidebarBody.style, {
                width: startWidth + 'px',
                flex: '0 0 auto',
                boxSizing: 'border-box',
                padding: '5px 0 10px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: '0',
            });

            const nav = document.createElement('div');
            Object.assign(nav.style, {
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                minHeight: NAV_MIN + 'px',
                padding: `0 ${GUTTER}`,
                boxSizing: 'border-box',
            });
            scrollFade(nav);
            const savedNavHeight = rawLoad(NAV_HEIGHT_KEY, null);
            if (savedNavHeight) nav.style.height = savedNavHeight + 'px';
            const pluginSection = ui.section('Plugins', {
                title: true,
                actions: [
                    { icon: ui.icon('chevronLeft', 16), title: 'Back', run: onBack },
                    { icon: ui.icon('chevronRight', 16), title: 'Forward', run: onForward },
                ],
            });
            // Read as the pointer arrives, so a remapped key is shown as remapped.
            ui.tip(pluginSection.actions[0], 'Back', () => chordOf('host.back'));
            ui.tip(pluginSection.actions[1], 'Forward', () => chordOf('host.forward'));
            pluginSection.style.marginTop = '0'; // it is the first thing in the column, not a divider
            nav.appendChild(pluginSection);

            // Rows are stepped back by mixing toward the ground, not by fading: a faded control lets the glass through.
            let current = null;
            const QUIET_ROW = blend(theme.contentColor, theme.contentBg, 0.72);
            const items = [];
            for (const row of rows) {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'deckit__item';
                item.dataset.pluginId = row.id;
                item.setAttribute('role', 'tab');
                Object.assign(item.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    minHeight: '28px',
                    padding: '0 8px',
                    border: '0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: QUIET_ROW,
                    font: '15px ' + theme.font,
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    transition: `background-color ${MOTION.fast} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
                });
                const glyph = document.createElement('span');
                glyph.innerHTML = row.icon;
                Object.assign(glyph.style, { display: 'flex', flex: '0 0 auto' });
                const nameText = document.createElement('span');
                nameText.textContent = row.name;
                item.append(glyph, nameText);
                item.addEventListener('click', () => onPick(row.id));
                ui.hoverable(item, () => row.id === current);
                items.push(item);
                pluginSection.body.appendChild(item);
            }
            const setCurrent = (id) => {
                current = id;
                for (const item of items) {
                    const on = item.dataset.pluginId === id;
                    item.style.color = on ? theme.contentColor : QUIET_ROW;
                    item.setAttribute('aria-selected', String(on));
                    item.repaint();
                }
            };
            // Nothing is redrawn after a drag, so the highlight and the hover stay on the rows they were on.
            ui.sortable(pluginSection.body, (from, to) => {
                const inOrder = [...pluginSection.body.querySelectorAll('.deckit__item')];
                const moved = inOrder[from];
                const rest = inOrder.filter((el) => el !== moved);
                if (to < rest.length) pluginSection.body.insertBefore(moved, rest[to]);
                else rest[rest.length - 1].after(moved);
                onReorder?.([...pluginSection.body.querySelectorAll('.deckit__item')].map((el) => el.dataset.pluginId));
            });

            const splitter = document.createElement('div');
            Object.assign(splitter.style, {
                flex: '0 0 auto',
                height: '9px',
                margin: `4px ${GUTTER} 0`,
                cursor: 'row-resize',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
            });
            const splitterLine = document.createElement('div');
            Object.assign(splitterLine.style, {
                width: '100%',
                borderTop: theme.border,
                opacity: '.7',
                transition: `opacity ${MOTION.base} ${MOTION.ease}`,
            });
            splitter.addEventListener('mouseenter', () => {
                splitterLine.style.opacity = '1';
            });
            splitter.addEventListener('mouseleave', () => {
                splitterLine.style.opacity = '.7';
            });
            splitter.appendChild(splitterLine);
            /* No double-click reset: preventDefault on mousedown stops Chromium synthesising the click pair,
       so it would never fire. */
            splitter.title = 'Drag to resize';

            ui.resizer(splitter, {
                axis: 'y',
                size: () => nav.getBoundingClientRect().height,
                min: NAV_MIN,
                // Subtract from the height nav can actually use, not the whole sidebar, or SLOT_MIN breaks.
                max: () => {
                    const cs = getComputedStyle(sidebarBody);
                    const usable = sidebarBody.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
                    return Math.max(
                        NAV_MIN,
                        usable - splitter.offsetHeight - parseFloat(getComputedStyle(splitter).marginTop) - SLOT_MIN
                    );
                },
                resize: (px) => {
                    nav.style.height = px + 'px';
                },
                commit: (px) => {
                    nav.style.height = px + 'px';
                    rawSave(NAV_HEIGHT_KEY, Math.round(px));
                },
            });
            // Lower sidebar: the slot the active plugin fills.
            const slot = document.createElement('div');
            slot.className = 'deckit__slot';
            Object.assign(slot.style, {
                flex: '1 1 auto',
                minHeight: '0',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: `0 ${GUTTER}`,
                boxSizing: 'border-box',
            });
            scrollFade(slot);

            /* On `content`, not on the sidebar: at left:0 it stands on the boundary whatever the width, and it
       outlives the sidebar being folded away. */
            const HANDLE_IDLE = blend(theme.contentColor, theme.contentBg, 0.26);
            const HANDLE_HOVER = blend(theme.contentColor, theme.contentBg, 0.62);
            const handle = document.createElement('button');
            handle.type = 'button';
            Object.assign(handle.style, {
                position: 'absolute',
                top: '50%',
                left: '0',
                zIndex: '5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '64px',
                padding: '0',
                border: '0',
                background: 'transparent',
                color: theme.contentColor,
                cursor: 'col-resize',
                transition: `transform ${MOTION.base} ${MOTION.ease}, left ${MOTION.base} ${MOTION.ease}`,
            });

            // The button around the capsule is the hit area: a 4px pill alone is not aimable.
            const capsule = document.createElement('span');
            Object.assign(capsule.style, {
                width: '4px',
                height: '36px',
                borderRadius: '999px',
                background: HANDLE_IDLE,
                transition:
                    `background-color ${MOTION.fast} ${MOTION.ease}, height ${MOTION.fast} ${MOTION.ease},` +
                    ` width ${MOTION.fast} ${MOTION.ease}`,
            });
            handle.appendChild(capsule);

            let dragging = false;
            const paintHandle = (on) => {
                capsule.style.background = on ? HANDLE_HOVER : HANDLE_IDLE;
                capsule.style.width = on ? '5px' : '4px';
                capsule.style.height = on ? '48px' : '36px';
            };
            handle.addEventListener('mouseenter', () => paintHandle(true));
            handle.addEventListener('mouseleave', () => {
                if (!dragging) paintHandle(false);
            });

            let collapsed = rawLoad(COLLAPSED_KEY, false) === true;

            /* Folding animates width, a layout property, so every plugin frame in the content column is laid
       out again each frame and the fold can stutter. A transform instead makes the page jump to its
       final width and stop following the fold, which is worse: the stutter is the side to pay on. */
            const setCollapsed = (on, animate = true) => {
                collapsed = on;
                sidebar.style.transition = animate
                    ? `width ${MOTION.base} ${MOTION.ease}, margin ${MOTION.base} ${MOTION.ease}, opacity ${MOTION.base} ${MOTION.ease}`
                    : 'none';
                sidebar.style.width = on ? '0px' : sidebarBody.style.width;
                // Folded, the card's inset and rim would still leave a sliver standing at the edge.
                sidebar.style.marginLeft = sidebar.style.marginRight = on ? '0px' : INSET + 'px';
                sidebar.style.borderWidth = on ? '0px' : '1px';
                sidebar.style.opacity = on ? '0' : '1';
                // Folded, it only opens: there is nothing to resize until it does.
                handle.title = on ? 'Show sidebar' : 'Hide sidebar \u00b7 drag to resize';
                handle.style.cursor = on ? 'pointer' : 'col-resize';
                handle.setAttribute('aria-label', handle.title);
                handle.setAttribute('aria-expanded', String(!on));
                // Folded, half of it would be clipped past the panel, so it tucks inside, sliding with the fold.
                handle.style.transform = on ? 'translate(3px, -50%)' : 'translate(-50%, -50%)';
                handle.style.left = on ? '0' : HANDLE_OUT + 'px';
                rawSave(COLLAPSED_KEY, on);
            };

            /* Whichever is smaller: the one allowed anywhere, or what leaves the plugin room to draw. Read, not
     stored, because the window resizes. */
            const CONTENT_MIN = 360;
            const widthCeiling = () =>
                Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, root.getBoundingClientRect().width - CONTENT_MIN));

            const setWidth = (w) => {
                const clamped = Math.min(widthCeiling(), Math.max(SIDEBAR_MIN, w));
                sidebar.style.width = sidebarBody.style.width = clamped + 'px';
                return clamped;
            };

            // A window that shrank must not leave the sidebar wider than what is left of it.
            window.addEventListener('resize', () => {
                if (!collapsed) setWidth(sidebar.getBoundingClientRect().width);
            });

            /* Folded, the press is only a click: a drag that folded or opened the sidebar would animate its
       width under the pointer. Below the minimum the card gives a little over a body that keeps its
       width. The width remembered is the last one left, which a click opens to. */
            ui.resizer(handle, {
                axis: 'x',
                size: () => sidebar.getBoundingClientRect().width,
                min: SIDEBAR_MIN,
                max: widthCeiling,
                resizable: () => !collapsed,
                resize: (px) => {
                    sidebar.style.transition = 'none';
                    sidebar.style.width = px + 'px';
                    sidebarBody.style.width = Math.max(SIDEBAR_MIN, px) + 'px';
                },
                commit: (px) => {
                    rawSave(WIDTH_KEY, Math.round(setWidth(px)));
                },
                onClick: () => setCollapsed(!collapsed),
                onDrag: (on) => {
                    dragging = on;
                    paintHandle(on || handle.matches(':hover'));
                },
            });

            content.appendChild(handle);
            setCollapsed(collapsed, false);

            sidebarBody.append(nav, splitter, slot);
            sidebar.appendChild(sidebarBody);
            return {
                element: sidebar,
                setHistory: (back, forward) => {
                    pluginSection.actions[0].setEnabled(!!back);
                    pluginSection.actions[1].setEnabled(!!forward);
                },
                toggle: () => setCollapsed(!collapsed),
                setCurrent,
            };
        };

        return { make };
    }
);
