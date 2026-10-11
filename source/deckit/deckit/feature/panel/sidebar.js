DeckitModule.define(
    'deckit/feature/panel/sidebar',
    {
        uses: ['deckit/ui/token', 'deckit/ui/kit', 'deckit/ui/glyph'],
        provides: ['make'],
        runs: 'page',
    },
    (TOKEN, UI, GLYPH) => {
        // MARK: - Property
        // A generous ceiling: in a window of its own the panel has room, and sidebar lists want width.
        const WIDTH_MIN = 240;
        const WIDTH_MAX = 720;
        const NAV_MIN = 70;
        const SLOT_MIN = 120;
        // Leaves the plugin room to draw beside the sidebar.
        const CONTENT_MIN = 360;
        // The handle stands a little past the gap, over the content's edge: centred in the gap it reads as the card's.
        const INSET = 8;
        const RADIUS = 12;
        const HANDLE_OUT = 6;
        const GUTTER = '12px';

        // MARK: - Initializer
        // MARK: - Public
        // The panel's sidebar card: the plugins' list over the plugin's own sidebar. What it shows is main's
        // (`state`), and what the person changes is told back: `onPick`, `onStep`, `onReorder`, `onLayout`.
        function make({ theme, ui, root, content, sidebar, onPick, onStep, onReorder, onLayout, chordOf }) {
            const { MOTION, blend, scrollFade } = UI;
            const dark = TOKEN.isDark(theme.contentBg);
            // Its ink is the content's, not the sidebar colour, which is chosen against a sidebar fill.
            const wash = (alpha) => (dark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
            const quietRow = blend(theme.contentColor, theme.contentBg, 0.72);
            let layout = { width: WIDTH_MIN, collapsed: false, navHeight: null };
            let current = null;
            let dragging = false;

            // Two boxes: the card animates its width while the body keeps its own, so what is inside does not reflow
            // against its minimum widths every frame.
            const card = element('div', {
                flex: '0 0 auto',
                background: `linear-gradient(180deg, ${wash(dark ? 0.045 : 0.03)}, ${wash(dark ? 0.025 : 0.015)})`,
                color: theme.contentColor,
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
            });
            // 5 at the top lines the heading up with a plugin's header in the content column. The side gutter is in
            // each part that scrolls, so a scrollbar runs down the card's edge.
            const body = element('div', {
                flex: '0 0 auto',
                boxSizing: 'border-box',
                padding: '5px 0 10px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: '0',
            });
            const nav = element('div', {
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                minHeight: NAV_MIN + 'px',
                padding: `0 ${GUTTER}`,
                boxSizing: 'border-box',
            });
            scrollFade(nav);
            const section = ui.section('Plugins', {
                title: true,
                actions: [
                    { icon: ui.icon('chevronLeft', 16), title: 'Back', run: () => onStep(-1) },
                    { icon: ui.icon('chevronRight', 16), title: 'Forward', run: () => onStep(1) },
                ],
            });
            ui.tip(section.actions[0], 'Back', () => chordOf('back'));
            ui.tip(section.actions[1], 'Forward', () => chordOf('forward'));
            section.style.marginTop = '0';
            nav.appendChild(section);
            // Nothing is drawn again after a drag: main hears the order and every view follows.
            ui.sortable(section.body, (from, to) => {
                const rows = [...section.body.children];
                const moved = rows[from];
                const rest = rows.filter((row) => row !== moved);
                if (to < rest.length) section.body.insertBefore(moved, rest[to]);
                else rest.at(-1).after(moved);
                onReorder([...section.body.children].map((row) => row.dataset.pluginId));
            });

            const splitter = element('div', {
                flex: '0 0 auto',
                height: '9px',
                margin: `4px ${GUTTER} 0`,
                cursor: 'row-resize',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
            });
            const line = element('div', {
                width: '100%',
                borderTop: theme.border,
                opacity: '.7',
                transition: `opacity ${MOTION.base} ${MOTION.ease}`,
            });
            splitter.addEventListener('mouseenter', () => (line.style.opacity = '1'));
            splitter.addEventListener('mouseleave', () => (line.style.opacity = '.7'));
            splitter.appendChild(line);
            splitter.title = 'Drag to resize';
            ui.resizer(splitter, {
                axis: 'y',
                size: () => nav.getBoundingClientRect().height,
                min: NAV_MIN,
                max: () => {
                    const style = getComputedStyle(body);
                    const usable = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
                    return Math.max(
                        NAV_MIN,
                        usable - splitter.offsetHeight - parseFloat(getComputedStyle(splitter).marginTop) - SLOT_MIN
                    );
                },
                resize: (px) => (nav.style.height = px + 'px'),
                commit: (px) => onLayout({ navHeight: Math.round(px) }),
            });

            // The plugin's own sidebar. Not shrunk, whatever the plugin set: the slot scrolls when it is taller.
            const slot = element('div', {
                flex: '1 1 auto',
                minHeight: '0',
                display: sidebar ? 'flex' : 'none',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: `0 ${GUTTER}`,
                boxSizing: 'border-box',
            });
            scrollFade(slot);
            if (sidebar) {
                sidebar.style.flexShrink = '0';
                slot.appendChild(sidebar);
            }

            // On the content, not the card: at left 0 it stands on the boundary whatever the width, and it outlives
            // the card being folded away.
            const handleIdle = blend(theme.contentColor, theme.contentBg, 0.26);
            const handleHover = blend(theme.contentColor, theme.contentBg, 0.62);
            const handle = element('button', {
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
                transition: `transform ${MOTION.base} ${MOTION.ease}, left ${MOTION.base} ${MOTION.ease}`,
            });
            handle.type = 'button';
            // The button around the capsule is what is aimed at: a 4px pill alone is not.
            const capsule = element('span', {
                width: '4px',
                height: '36px',
                borderRadius: '999px',
                background: handleIdle,
                transition: `background-color ${MOTION.fast} ${MOTION.ease}, height ${MOTION.fast} ${MOTION.ease}, width ${MOTION.fast} ${MOTION.ease}`,
            });
            handle.appendChild(capsule);
            handle.addEventListener('mouseenter', () => paintHandle(true));
            handle.addEventListener('mouseleave', () => !dragging && paintHandle(false));
            // Folded, a press is only a click: a drag that folded or opened the card would animate its width under the
            // pointer.
            ui.resizer(handle, {
                axis: 'x',
                size: () => card.getBoundingClientRect().width,
                min: WIDTH_MIN,
                max: ceiling,
                resizable: () => !layout.collapsed,
                resize: (px) => {
                    card.style.transition = 'none';
                    card.style.width = px + 'px';
                    body.style.width = Math.max(WIDTH_MIN, px) + 'px';
                },
                commit: (px) => onLayout({ width: Math.round(clamp(px)) }),
                onClick: () => onLayout({ collapsed: !layout.collapsed }),
                onDrag: (on) => {
                    dragging = on;
                    paintHandle(on || handle.matches(':hover'));
                },
            });
            content.appendChild(handle);
            // A window that shrank must not leave the card wider than what is left of it.
            window.addEventListener('resize', () => !layout.collapsed && apply(layout, false));

            body.append(nav, splitter, slot);
            card.appendChild(body);

            function paintHandle(on) {
                capsule.style.background = on ? handleHover : handleIdle;
                capsule.style.width = on ? '5px' : '4px';
                capsule.style.height = on ? '48px' : '36px';
            }

            // The smaller of the one allowed anywhere and what leaves the plugin room. Read, not kept: the window resizes.
            function ceiling() {
                return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, root.getBoundingClientRect().width - CONTENT_MIN));
            }

            function clamp(width) {
                return Math.min(ceiling(), Math.max(WIDTH_MIN, width));
            }

            // Folding animates width, a layout property, so the content is laid out again each frame and the fold
            // can stutter; a transform would make the page jump to its final width instead, which is worse.
            function apply(next, animate) {
                layout = next;
                const width = clamp(next.width);
                card.style.transition = animate
                    ? `width ${MOTION.base} ${MOTION.ease}, margin ${MOTION.base} ${MOTION.ease}, opacity ${MOTION.base} ${MOTION.ease}`
                    : 'none';
                body.style.width = width + 'px';
                card.style.width = next.collapsed ? '0px' : width + 'px';
                // Folded, the card's inset and rim would still leave a sliver at the edge.
                card.style.marginLeft = card.style.marginRight = next.collapsed ? '0px' : INSET + 'px';
                card.style.borderWidth = next.collapsed ? '0px' : '1px';
                card.style.opacity = next.collapsed ? '0' : '1';
                if (next.navHeight) nav.style.height = next.navHeight + 'px';
                // Folded, there is nothing to resize until it opens, and half the handle would be clipped past the panel.
                handle.title = next.collapsed ? 'Show sidebar' : 'Hide sidebar · drag to resize';
                handle.style.cursor = next.collapsed ? 'pointer' : 'col-resize';
                handle.setAttribute('aria-label', handle.title);
                handle.setAttribute('aria-expanded', String(!next.collapsed));
                handle.style.transform = next.collapsed ? 'translate(3px, -50%)' : 'translate(-50%, -50%)';
                handle.style.left = next.collapsed ? '0' : HANDLE_OUT + 'px';
            }

            // Rows are stepped back by mixing toward the ground, not by fading: a faded control lets the glass through.
            function show({ plugins, current: on, canBack, canForward, frame }, animate) {
                current = on;
                section.body.replaceChildren(...plugins.map((plugin) => rowOf(plugin)));
                section.actions[0].setEnabled(canBack);
                section.actions[1].setEnabled(canForward);
                apply(frame, animate);
            }

            function rowOf(plugin) {
                const row = element('button', {
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
                    color: plugin.id === current ? theme.contentColor : quietRow,
                    font: '15px ' + theme.font,
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    transition: `background-color ${MOTION.fast} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
                });
                row.type = 'button';
                row.dataset.pluginId = plugin.id;
                row.setAttribute('role', 'tab');
                row.setAttribute('aria-selected', String(plugin.id === current));
                const glyph = element('span', { display: 'flex', flex: '0 0 auto' });
                glyph.append(GLYPH.glyphOf(plugin.icon));
                const name = element('span', {});
                name.textContent = plugin.name;
                row.append(glyph, name);
                row.addEventListener('click', () => onPick(plugin.id));
                ui.hoverable(row, () => plugin.id === current);
                return row;
            }

            return { element: card, show };
        }

        // MARK: - Private
        function element(tag, style) {
            const made = document.createElement(tag);
            Object.assign(made.style, style);
            return made;
        }

        return { make };
    }
);
