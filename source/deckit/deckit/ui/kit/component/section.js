DeckitModule.define(
    'deckit/ui/kit/component/section',
    {
        uses: ['deckit/ui/token', 'deckit/ui/kit/part'],
        provides: ['make'],
    },
    (T, K) => {
        const { MOTION, icon, pressable } = T;
        // A fold's caret column, and the gap after it, in front of a heading that folds.
        const CARET = 20,
            HEAD_GAP = 6;

        return {
            make: (theme, ui, inner) => {
                const { QUIET, mix } = inner;
                return {
                    section(label, opts = {}) {
                        // `icon` is taken here by the option, so the glyph helper is reached by its own name.
                        const {
                            icon: iconSvg = '',
                            actions = [],
                            onCollapse = null,
                            title = false,
                            onHeading = null,
                            onHeadingMenu = null,
                            headingTitle = '',
                        } = opts;
                        const foldable = typeof opts.collapsed === 'boolean';
                        const pressed = foldable || typeof onHeading === 'function';

                        const root = document.createElement('div');
                        // Never shrunk: the sidebar scrolls as one.
                        Object.assign(root.style, {
                            display: 'flex',
                            flexDirection: 'column',
                            flex: '0 0 auto',
                            marginTop: '10px',
                        });

                        const head = document.createElement('div');
                        Object.assign(head.style, {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            height: title ? '38px' : '32px',
                            marginBottom: '4px',
                            flex: '0 0 auto',
                        });

                        const heading = document.createElement(pressed ? 'button' : 'div');
                        Object.assign(heading.style, {
                            display: 'flex',
                            alignItems: 'center',
                            gap: HEAD_GAP + 'px',
                            flex: '1 1 auto',
                            minWidth: '0',
                            border: '0',
                            background: 'transparent',
                            color: 'inherit',
                            textAlign: 'left',
                            height: '28px',
                            padding: `0 6px 0 ${foldable ? 0 : K.ROW_SIDE}px`,
                            borderRadius: '6px',
                            cursor: pressed ? 'pointer' : 'default',
                            transition: `background-color ${MOTION.fast} ${MOTION.ease}`,
                        });
                        if (pressed) {
                            heading.type = 'button';
                            heading.title = foldable ? 'Collapse or expand' : headingTitle || label;
                            pressable(heading);
                        }
                        if (!foldable && onHeading) heading.addEventListener('click', () => onHeading());
                        if (onHeadingMenu)
                            heading.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                onHeadingMenu(e);
                            });

                        const caret = document.createElement('span');
                        caret.innerHTML = icon('chevronDown', 16);
                        Object.assign(caret.style, {
                            display: foldable ? 'flex' : 'none',
                            flex: '0 0 auto',
                            width: CARET + 'px',
                            justifyContent: 'center',
                            transition: `transform ${MOTION.base} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
                        });

                        const glyph = document.createElement('span');
                        glyph.innerHTML = iconSvg;
                        Object.assign(glyph.style, {
                            display: iconSvg ? 'flex' : 'none',
                            flex: '0 0 auto',
                            marginRight: '2px',
                        });

                        const text = document.createElement('span');
                        text.textContent = label;
                        Object.assign(text.style, {
                            font: title ? '800 18px ' + theme.font : '700 16px ' + theme.font,
                            letterSpacing: title ? '-.1px' : '.08px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        });
                        heading.append(caret, glyph, text);
                        head.appendChild(heading);

                        const actionBtns = actions.map((a) => {
                            const b = ui.iconBtn(
                                a.icon || icon('plus', 16),
                                a.title,
                                (e) => {
                                    e.stopPropagation();
                                    a.run(b);
                                },
                                { quiet: true }
                            );
                            head.appendChild(b);
                            return b;
                        });

                        const body = document.createElement('div');
                        Object.assign(body.style, {
                            display: 'flex',
                            flexDirection: 'column',
                            flex: '0 0 auto',
                            paddingLeft: foldable ? CARET + HEAD_GAP - K.ROW_SIDE + 'px' : '0', // a row's first element exactly under the heading's icon
                            transition: `opacity ${MOTION.fast} ${MOTION.ease}`,
                        });

                        let folded = !!opts.collapsed;
                        const apply = (animate) => {
                            caret.style.transform = folded ? 'rotate(-90deg)' : 'none';
                            text.style.color = folded ? mix(0.55) : title ? theme.contentColor : mix(0.95);
                            glyph.style.color = folded ? mix(0.4) : mix(0.75);
                            caret.style.color = folded ? mix(0.45) : mix(0.75);
                            if (folded) {
                                body.style.opacity = '0';
                                const ms = animate ? parseFloat(MOTION.fast) || 0 : 0;
                                if (ms)
                                    setTimeout(() => {
                                        if (folded) body.style.display = 'none';
                                    }, ms);
                                else body.style.display = 'none';
                            } else if (animate) {
                                T.play(body, { display: 'flex', opacity: '0' }, { opacity: '1' });
                            } else {
                                Object.assign(body.style, { display: 'flex', opacity: '1' });
                            }
                            if (foldable) heading.setAttribute('aria-expanded', String(!folded));
                        };
                        if (foldable) {
                            heading.addEventListener('click', () => {
                                folded = !folded;
                                apply(true);
                                onCollapse?.(folded);
                            });
                        }
                        apply(false);

                        root.append(head, body);
                        root.body = body;
                        root.heading = heading;
                        /* Through the press, which owns the heading's background: written over it directly, the light
           went at the first pass of the pointer. */
                        root.setCurrent = (on) => {
                            const color = on ? T.WASH.cursor : '';
                            if (heading.setRest) heading.setRest(color);
                            else heading.style.background = color || 'transparent';
                        };
                        root.actions = actionBtns;
                        root.setCollapsed = (v) => {
                            folded = !!v;
                            apply(true);
                        };
                        root.isCollapsed = () => folded;
                        return root;
                    },
                    breadcrumb({ onGo } = {}) {
                        const bar = document.createElement('div');
                        Object.assign(bar.style, {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            flex: '1 1 auto',
                            minWidth: '0',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        });
                        // Nothing gives way while the fold is measured; the last part is let shrink only after it.
                        const partStyle = (b, current) =>
                            Object.assign(b.style, {
                                flex: '0 0 auto',
                                minWidth: '0',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                border: '0',
                                background: 'transparent',
                                padding: '2px 5px',
                                borderRadius: '5px',
                                color: current ? theme.contentColor : QUIET,
                                font: (current ? '600 ' : '') + '13px ' + theme.font,
                                cursor: current ? 'default' : 'pointer',
                            });
                        const separator = () => {
                            const sep = document.createElement('span');
                            sep.innerHTML = icon('chevronRight', 11);
                            Object.assign(sep.style, { display: 'flex', flex: '0 0 auto', color: QUIET });
                            return sep;
                        };
                        let parts = [];
                        const draw = () => {
                            bar.textContent = '';
                            const more = document.createElement('button');
                            more.type = 'button';
                            more.textContent = '…';
                            more.title = 'Hidden places';
                            partStyle(more, false);
                            pressable(more);
                            const moreSep = separator();
                            const items = parts.map((part, i) => {
                                const b = document.createElement('button');
                                b.type = 'button';
                                b.textContent = part.label;
                                b.title = part.title || part.label;
                                b.dataset.crumb = part.key;
                                partStyle(b, part.current);
                                if (!part.current) {
                                    pressable(b);
                                    b.addEventListener('click', () => onGo?.(part.key));
                                }
                                return { part, sep: i ? separator() : null, b };
                            });
                            bar.append(more, moreSep);
                            for (const it of items) {
                                if (it.sep) bar.appendChild(it.sep);
                                bar.appendChild(it.b);
                            }
                            more.style.display = moreSep.style.display = 'none';
                            let folded = 0;
                            const fits = () => bar.scrollWidth <= bar.clientWidth + 1;
                            while (!fits() && folded < items.length - 1) {
                                const it = items[folded];
                                it.b.style.display = 'none';
                                if (it.sep) it.sep.style.display = 'none';
                                // The first part shown after the fold takes no separator of its own: the "…" has one.
                                const next = items[folded + 1];
                                if (next.sep) next.sep.style.display = 'none';
                                more.style.display = moreSep.style.display = '';
                                folded++;
                            }
                            if (folded) {
                                const hidden = items
                                    .slice(0, folded)
                                    .map((it) => it.part)
                                    .reverse();
                                more.dataset.crumb = hidden[0].key;
                                more.addEventListener('click', () =>
                                    ui.menu(
                                        hidden.map((p) => ({
                                            label: p.label,
                                            ...(p.icon ? { icon: p.icon } : {}),
                                            run: () => onGo?.(p.key),
                                        })),
                                        { anchor: more }
                                    )
                                );
                            }
                            // Folded as far as it goes and still too long: the last part is cut short, and only it.
                            if (!fits() && items.length)
                                Object.assign(items[items.length - 1].b.style, { flexShrink: '1', minWidth: '30px' });
                        };
                        /* The same parts again are left as they are drawn: a redraw would replace the button under
           a press, or the "…" a menu is anchored to. */
                        let drawn = '';
                        bar.setParts = (next) => {
                            parts = next || [];
                            const key = JSON.stringify(
                                parts.map((p) => [p.key, p.label, p.title || '', !!p.current, p.icon || ''])
                            );
                            if (key === drawn) return;
                            drawn = key;
                            draw();
                        };
                        // Drawn again as its room changes; folding is measured, and the room is the layout's.
                        let width = 0;
                        new ResizeObserver(() => {
                            const w = bar.clientWidth;
                            if (w !== width) {
                                width = w;
                                if (parts.length) draw();
                            }
                        }).observe(bar);
                        return bar;
                    },
                };
            },
        };
    }
);
