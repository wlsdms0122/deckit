DeckitModule.define(
    'shell/feature/panel/sidebar',
    {
        uses: ['shell/ui/icon', 'shell/ui/scroll', 'shell/ui/kit', 'shell/ui/list'],
        provides: ['make'],
        runs: 'page',
    },
    (ICON, SCROLL, KIT, LIST) => {
        // MARK: - Property
        // A generous ceiling: in a window of its own the panel has room, and sidebar lists want width.
        const WIDTH_MIN = 240;
        const WIDTH_MAX = 720;
        const NAV_MIN = 70;
        const SLOT_MIN = 120;
        // Leaves the mod room to draw beside the sidebar.
        const CONTENT_MIN = 360;
        // The card's inset from the panel's edges, and how far the handle stands past it, over the content's edge.
        const INSET = 8;
        const HANDLE_OUT = 6;
        const STYLE = `
            .deckit-sidebar {
                position: relative;
                display: flex;
                flex-direction: column;
                flex: 0 0 auto;
                min-height: 0;
                box-sizing: border-box;
                margin: ${INSET}px;
                overflow: hidden;
                border: 1px solid var(--deckit-sidebar-rim);
                border-radius: var(--deckit-radius-card);
                background: linear-gradient(180deg, var(--deckit-sidebar-top), var(--deckit-sidebar-bottom));
                box-shadow: var(--deckit-sidebar-shadow);
                color: var(--deckit-text);
            }
            .deckit-sidebar-title-bar { position: absolute; top: 0; left: 0; right: 0; -webkit-app-region: drag; }
            .deckit-sidebar-body {
                display: flex;
                flex-direction: column;
                flex: 0 0 auto;
                height: 100%;
                min-height: 0;
                box-sizing: border-box;
                padding: 5px 0 10px;
            }
            .deckit-sidebar-nav,
            .deckit-sidebar-slot {
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                box-sizing: border-box;
                padding: 0 12px;
            }
            .deckit-sidebar-nav { flex: 0 0 auto; min-height: ${NAV_MIN}px; }
            .deckit-sidebar-nav .deckit-section { margin-top: 0; }
            .deckit-sidebar-slot { flex: 1 1 auto; min-height: 0; }
            .deckit-sidebar-slot[hidden] { display: none; }
            .deckit-sidebar-slot > * { flex-shrink: 0; }
            .deckit-sidebar-splitter {
                position: relative;
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                height: 9px;
                margin: 4px 12px 0;
                cursor: row-resize;
            }
            .deckit-sidebar-splitter::before {
                content: '';
                width: 100%;
                border-top: var(--deckit-border);
                opacity: 0.7;
                transition: opacity var(--deckit-base) var(--deckit-easing);
            }
            .deckit-sidebar-splitter:hover::before { opacity: 1; }
            .deckit-sidebar-handle {
                position: absolute;
                top: 50%;
                left: ${HANDLE_OUT}px;
                z-index: 5;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 64px;
                padding: 0;
                border: 0;
                background: transparent;
                cursor: col-resize;
                transform: translate(-50%, -50%);
                transition:
                    transform var(--deckit-base) var(--deckit-easing),
                    left var(--deckit-base) var(--deckit-easing);
            }
            .deckit-sidebar-handle[aria-expanded='false'] { left: 0; cursor: pointer; transform: translate(3px, -50%); }
            .deckit-sidebar-handle::before {
                content: '';
                width: 4px;
                height: 36px;
                border-radius: var(--deckit-radius-round);
                background: var(--deckit-disabled);
                transition:
                    background-color var(--deckit-fast) var(--deckit-easing),
                    height var(--deckit-fast) var(--deckit-easing),
                    width var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-sidebar-handle:hover::before,
            .deckit-sidebar-handle[data-dragging]::before { width: 5px; height: 48px; background: var(--deckit-muted); }
            .deckit-mod-row {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                min-height: 28px;
                box-sizing: border-box;
                padding: 0 8px;
                border: 0;
                outline: none;
                border-radius: var(--deckit-radius-control);
                background: transparent;
                color: inherit;
                font: var(--deckit-type-large);
                text-align: left;
                cursor: pointer;
                transition: background-color var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-mod-row:hover { background: var(--deckit-hover); }
            .deckit-mod-row[aria-selected='true'] { background: var(--deckit-selected); }
            .deckit-mod-row:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-mod-icon { display: flex; flex: 0 0 auto; }
        `;

        // MARK: - Initializer
        // MARK: - Public
        // The panel's sidebar card: the mods' list over the mod's own sidebar. What it shows is main's (`state`),
        // and what the person changes is told back: `onPick`, `onStep`, `onReorder`, `onLayout`. `onCollapsedChange`
        // hears the card collapse or open.
        function make({
            theme,
            ui,
            root,
            content,
            sidebar,
            onPick,
            onStep,
            onReorder,
            onLayout,
            onCollapsedChange,
            chordOf,
        }) {
            KIT.addStyle(surfaceOf(theme) + STYLE);
            let layout = { width: WIDTH_MIN, collapsed: false, navHeight: null };
            let mods = [];
            let current = null;
            let inRegion = false;

            // Two boxes: the card animates its width while the body keeps its own, so what is inside does not reflow
            // against its minimum widths every frame.
            const card = element('div', 'deckit-sidebar');
            const body = element('div', 'deckit-sidebar-body');
            const titleBarRoom = element('div', 'deckit-sidebar-title-bar');
            const nav = element('div', 'deckit-sidebar-nav');
            SCROLL.edgeFade(nav);
            const section = ui.section({
                label: 'Mods',
                title: true,
                actions: [
                    { icon: ICON.icon('chevronLeft', { size: 16 }), title: 'Back', run: () => onStep(-1) },
                    { icon: ICON.icon('chevronRight', { size: 16 }), title: 'Forward', run: () => onStep(1) },
                ],
            });
            ui.tooltip(section.actions[0].element, { text: 'Back', chord: () => chordOf('back') });
            ui.tooltip(section.actions[1].element, { text: 'Forward', chord: () => chordOf('forward') });
            nav.append(section.element);
            const rows = LIST.list({
                element: section.body,
                key: (mod) => mod.id,
                create: rowOf,
                update: (row, mod) => paintRow(row, mod),
            });
            // The new order is drawn here at once, and main, hearing it, has every view follow.
            ui.sortable(rows, {
                onReorder: (id, toId) => {
                    const moved = mods.find((mod) => mod.id === id);
                    const to = mods.findIndex((mod) => mod.id === toId);
                    if (!moved || to < 0) return;
                    const rest = mods.filter((mod) => mod !== moved);
                    mods = [...rest.slice(0, to), moved, ...rest.slice(to)];
                    rows.set(mods);
                    onReorder(mods.map((mod) => mod.id));
                },
            });

            const splitter = element('div', 'deckit-sidebar-splitter');
            splitter.title = 'Drag to resize';
            ui.resizer(splitter, {
                axis: 'y',
                size: () => nav.getBoundingClientRect().height,
                min: NAV_MIN,
                max: () => {
                    const style = getComputedStyle(body);
                    const usable = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
                    const below = splitter.offsetHeight + parseFloat(getComputedStyle(splitter).marginTop) + SLOT_MIN;
                    return Math.max(NAV_MIN, usable - below);
                },
                onResize: (px) => (nav.style.height = px + 'px'),
                onCommit: (px) => onLayout({ navHeight: Math.round(px) }),
            });

            // The mod's own sidebar: the slot scrolls when it is taller.
            const slot = element('div', 'deckit-sidebar-slot');
            slot.hidden = !sidebar;
            SCROLL.edgeFade(slot);
            if (sidebar) slot.append(sidebar);

            // On the content, not the card: at its left edge it stands on the boundary whatever the width, and it
            // outlives the card being folded away. Folded, a press is only a click: a drag that folded or opened the
            // card would animate its width under the pointer.
            const handle = element('button', 'deckit-sidebar-handle');
            handle.type = 'button';
            ui.resizer(handle, {
                axis: 'x',
                size: () => card.getBoundingClientRect().width,
                min: WIDTH_MIN,
                max: ceiling,
                resizable: () => !layout.collapsed,
                onResize: (px) => {
                    card.style.transition = 'none';
                    card.style.width = px + 'px';
                    body.style.width = Math.max(WIDTH_MIN, px) + 'px';
                },
                onCommit: (px) => onLayout({ width: Math.round(clamp(px)) }),
                onClick: () => onLayout({ collapsed: !layout.collapsed }),
                onDrag: (on) => handle.toggleAttribute('data-dragging', on),
            });
            content.append(handle);
            // A window that shrank must not leave the card wider than what is left of it.
            window.addEventListener('resize', () => !layout.collapsed && apply(layout, false));

            body.append(nav, splitter, slot);
            card.append(body, titleBarRoom);

            // The smaller of the one allowed anywhere and what leaves the mod room. Read, not kept: the window resizes.
            function ceiling() {
                return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, root.getBoundingClientRect().width - CONTENT_MIN));
            }

            function clamp(width) {
                return Math.min(ceiling(), Math.max(WIDTH_MIN, width));
            }

            // Folding animates width, a layout property, so the content is laid out again each frame and can stutter; a
            // transform would make the page jump to its final width instead.
            function apply(next, animate) {
                const collapsedChanged = next.collapsed !== layout.collapsed;
                layout = next;
                // The panel's folding is the panel's: in a region the mod's own sidebar stays.
                next = inRegion ? { ...next, collapsed: false } : next;
                const width = clamp(next.width);
                const { base } = theme.motion;
                card.style.transition = animate
                    ? ['width', 'margin', 'opacity']
                          .map((property) => `${property} ${base}ms ${theme.motion.easing}`)
                          .join(', ')
                    : 'none';
                body.style.width = width + 'px';
                card.style.width = next.collapsed ? '0px' : width + 'px';
                // Folded, the card's inset and rim would still leave a sliver at the edge.
                card.style.marginLeft = card.style.marginRight = next.collapsed ? '0px' : INSET + 'px';
                card.style.borderWidth = next.collapsed ? '0px' : '1px';
                card.style.opacity = next.collapsed ? '0' : '1';
                if (next.navHeight) nav.style.height = next.navHeight + 'px';
                handle.title = next.collapsed ? 'Show sidebar' : 'Hide sidebar · drag to resize';
                handle.setAttribute('aria-label', handle.title);
                handle.setAttribute('aria-expanded', String(!next.collapsed));
                if (collapsedChanged) onCollapsedChange();
            }

            function show(state, animate) {
                mods = state.mods;
                current = state.current;
                rows.set(mods);
                section.actions[0].setEnabled(state.canBack);
                section.actions[1].setEnabled(state.canForward);
                apply(state.frame, animate);
            }

            function rowOf(mod) {
                const row = element('button', 'deckit-mod-row');
                row.type = 'button';
                row.dataset.modId = mod.id;
                row.setAttribute('role', 'tab');
                row.addEventListener('click', () => onPick(mod.id));
                paintRow(row, mod);
                return row;
            }

            function paintRow(row, mod) {
                row.setAttribute('aria-selected', String(mod.id === current));
                const drawn = JSON.stringify([mod.icon, mod.name]);
                if (row.dataset.drawn === drawn) return;
                row.dataset.drawn = drawn;
                const glyph = element('span', 'deckit-mod-icon');
                glyph.append(ICON.sanitize(mod.icon));
                const name = element('span', '');
                name.textContent = mod.name;
                row.replaceChildren(glyph, name);
            }

            // Under a window's title bar `height` tall, what the card holds starts below it: the card's top, inset
            // from the window's, is where the window's buttons sit, and drags the window.
            function setTitleBarHeight(height) {
                const room = height ? Math.max(0, height - INSET) : 0;
                body.style.paddingTop = room ? room + 'px' : '';
                titleBarRoom.style.height = room + 'px';
            }

            // In a region of another mod's the card holds the mod's own sidebar alone, and none at all without one.
            function setInRegion(on) {
                if (on === inRegion) return;
                inRegion = on;
                for (const part of [nav, splitter, handle]) part.style.display = on ? 'none' : '';
                card.style.display = on && !sidebar ? 'none' : '';
                apply(layout, false);
            }

            return {
                element: card,
                show,
                setInRegion,
                setTitleBarHeight,
                collapsed: () => layout.collapsed && !inRegion,
            };
        }

        // MARK: - Private
        // The card's surface, drawn in the content's ink rather than the sidebar colour, which is chosen against a
        // sidebar fill.
        function surfaceOf(theme) {
            const ink = (alpha) => (theme.dark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
            const shadow = theme.dark
                ? 'inset 0 1px 0 rgba(255,255,255,.09), 0 1px 2px rgba(0,0,0,.35), 0 10px 28px rgba(0,0,0,.32)'
                : 'inset 0 1px 0 rgba(255,255,255,.8), 0 1px 2px rgba(0,0,0,.08), 0 10px 28px rgba(0,0,0,.10)';
            return `:root {
                --deckit-sidebar-top: ${ink(theme.dark ? 0.045 : 0.03)};
                --deckit-sidebar-bottom: ${ink(theme.dark ? 0.025 : 0.015)};
                --deckit-sidebar-rim: ${ink(theme.dark ? 0.1 : 0.08)};
                --deckit-sidebar-shadow: ${shadow};
            }`;
        }

        function element(tag, className) {
            const made = document.createElement(tag);
            if (className) made.className = className;
            return made;
        }

        return { make };
    }
);
