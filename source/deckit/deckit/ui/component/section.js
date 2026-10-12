DeckitModule.define(
    'deckit/ui/component/section',
    { uses: ['deckit/ui/token', 'deckit/ui/icon', 'deckit/ui/motion'], provides: ['STYLE', 'make'] },
    (TOKEN, ICON, MOTION) => {
        // MARK: - Property
        // A folding heading puts its caret (20px) and a gap (6px) before its label; the body moves in by the same less a
        // row's own side (8px), so a row's first element stands under the heading's icon.
        const STYLE = `
            .deckit-section { display: flex; flex-direction: column; flex: 0 0 auto; margin-top: 10px; }
            .deckit-section-head { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; height: 32px; margin-bottom: 4px; }
            .deckit-section[data-title] .deckit-section-head { height: 38px; }
            .deckit-section-heading {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1 1 auto;
                min-width: 0;
                height: 28px;
                padding: 0 6px 0 8px;
                border: 0;
                outline: none;
                border-radius: var(--deckit-radius-control);
                background: transparent;
                color: inherit;
                font: inherit;
                text-align: left;
                transition: background-color var(--deckit-fast) var(--deckit-easing);
            }
            button.deckit-section-heading { cursor: pointer; }
            button.deckit-section-heading:hover { background: var(--deckit-hover); }
            button.deckit-section-heading:active { background: var(--deckit-pressed); }
            button.deckit-section-heading:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-section-heading[data-current] { background: var(--deckit-selected); }
            .deckit-section[data-foldable] .deckit-section-heading { padding-left: 0; }
            .deckit-section-caret {
                display: none;
                flex: 0 0 auto;
                justify-content: center;
                width: 20px;
                color: var(--deckit-muted);
                transition:
                    transform var(--deckit-base) var(--deckit-easing),
                    color var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-section[data-foldable] .deckit-section-caret { display: flex; }
            .deckit-section-icon { display: flex; flex: 0 0 auto; margin-right: 2px; color: var(--deckit-muted); }
            .deckit-section-label {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--deckit-text);
                font: 700 var(--deckit-type-heading);
                letter-spacing: 0.08px;
            }
            .deckit-section[data-title] .deckit-section-label { font: 800 var(--deckit-type-title); letter-spacing: -0.1px; }
            .deckit-section[data-collapsed] .deckit-section-caret { transform: rotate(-90deg); color: var(--deckit-disabled); }
            .deckit-section[data-collapsed] .deckit-section-icon { color: var(--deckit-disabled); }
            .deckit-section[data-collapsed] .deckit-section-label { color: var(--deckit-muted); }
            .deckit-section-body {
                display: flex;
                flex-direction: column;
                flex: 0 0 auto;
                transition: opacity var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-section[data-foldable] .deckit-section-body { padding-left: 18px; }
            .deckit-section-body[hidden] { display: none; }
            .deckit-breadcrumb {
                display: flex;
                align-items: center;
                gap: 2px;
                flex: 1 1 auto;
                min-width: 0;
                overflow: hidden;
                white-space: nowrap;
            }
            .deckit-crumb {
                flex: 0 0 auto;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 2px 5px;
                border: 0;
                border-radius: var(--deckit-radius-small);
                background: transparent;
                color: var(--deckit-muted);
                font: var(--deckit-type-body);
                cursor: pointer;
            }
            .deckit-crumb:hover { background: var(--deckit-hover); }
            .deckit-crumb[aria-current='page'] { color: var(--deckit-text); font-weight: 600; cursor: default; background: transparent; }
            .deckit-crumb[data-shrinks] { flex-shrink: 1; min-width: 30px; }
            .deckit-crumb-separator { display: flex; flex: 0 0 auto; color: var(--deckit-muted); }
            .deckit-crumb[hidden], .deckit-crumb-separator[hidden] { display: none; }
        `;

        // MARK: - Initializer
        // MARK: - Public
        function make(theme, ui) {
            return { section: (options) => section(ui, options), breadcrumb: (options) => breadcrumb(ui, options) };
        }

        // MARK: - Private
        // A heading over a body. With `collapsed` a boolean the heading folds the body: a press reports the fold asked
        // for and the owner sets it. With `onHeading` the heading is pressed. `actions` are { icon, title, run(button) }
        // at the heading's end; `actions` of the result are their buttons.
        function section(
            ui,
            {
                label,
                icon = '',
                actions = [],
                collapsed,
                onToggle,
                title = false,
                onHeading = null,
                onHeadingMenu = null,
                headingTitle = '',
            }
        ) {
            const foldable = typeof collapsed === 'boolean';
            const pressed = foldable || typeof onHeading === 'function';
            const element = tag('div', 'deckit-section');
            element.toggleAttribute('data-title', title);
            element.toggleAttribute('data-foldable', foldable);
            const head = tag('div', 'deckit-section-head');
            const heading = tag(pressed ? 'button' : 'div', 'deckit-section-heading');
            if (pressed) {
                heading.type = 'button';
                heading.title = foldable ? 'Collapse or expand' : headingTitle || label;
            }
            if (foldable) heading.addEventListener('click', () => onToggle?.(!folded));
            else if (onHeading) heading.addEventListener('click', () => onHeading());
            if (onHeadingMenu)
                heading.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    onHeadingMenu(event);
                });
            const caret = tag('span', 'deckit-section-caret');
            caret.innerHTML = ICON.icon('chevronDown', { size: 16 });
            heading.append(caret);
            if (icon) {
                const glyph = tag('span', 'deckit-section-icon');
                glyph.innerHTML = icon;
                heading.append(glyph);
            }
            const text = tag('span', 'deckit-section-label');
            text.textContent = label;
            heading.append(text);
            head.append(heading);
            const buttons = actions.map((action) => {
                const button = ui.iconBtn({
                    icon: action.icon || ICON.icon('plus', { size: 16 }),
                    title: action.title,
                    muted: true,
                    onClick: (event) => {
                        event.stopPropagation();
                        action.run(button);
                    },
                });
                head.append(button.element);
                return button;
            });
            const body = tag('div', 'deckit-section-body');
            let folded = !!collapsed;
            const fold = (animate) => {
                element.toggleAttribute('data-collapsed', folded);
                if (foldable) heading.setAttribute('aria-expanded', String(!folded));
                if (!folded) {
                    body.hidden = false;
                    if (animate) MOTION.play(body, { opacity: '0' }, { opacity: '1' });
                    else body.style.opacity = '1';
                    return;
                }
                body.style.opacity = '0';
                const length = animate ? TOKEN.MOTION.fast : 0;
                if (length) setTimeout(() => folded && (body.hidden = true), length);
                else body.hidden = true;
            };
            fold(false);
            element.append(head, body);
            return {
                element,
                body,
                heading,
                actions: buttons,
                setCurrent: (on) => heading.toggleAttribute('data-current', !!on),
                setCollapsed: (next) => {
                    if (folded === !!next) return;
                    folded = !!next;
                    fold(true);
                },
                isCollapsed: () => folded,
            };
        }

        // Where a place is, as its path from the top. The parts that do not fit fold, from the start, into a "…" that
        // lists them; the last part is cut short only once everything before it has folded.
        function breadcrumb(ui, { onGo } = {}) {
            const bar = tag('div', 'deckit-breadcrumb');
            let parts = [];
            let drawn = '';
            let width = 0;
            const separator = () => {
                const made = tag('span', 'deckit-crumb-separator');
                made.innerHTML = ICON.icon('chevronRight', { size: 11 });
                return made;
            };
            const crumbOf = (part) => {
                const crumb = tag('button', 'deckit-crumb');
                crumb.type = 'button';
                crumb.textContent = part.label;
                crumb.title = part.title || part.label;
                crumb.dataset.crumb = part.key;
                if (part.current) crumb.setAttribute('aria-current', 'page');
                else crumb.addEventListener('click', () => onGo?.(part.key));
                return crumb;
            };
            const draw = () => {
                const more = tag('button', 'deckit-crumb');
                more.type = 'button';
                more.textContent = '…';
                more.title = 'Hidden places';
                const moreSeparator = separator();
                const shown = parts.map((part, index) => ({
                    part,
                    separator: index ? separator() : null,
                    crumb: crumbOf(part),
                }));
                bar.replaceChildren(
                    more,
                    moreSeparator,
                    ...shown.flatMap((each) => [each.separator, each.crumb].filter(Boolean))
                );
                more.hidden = moreSeparator.hidden = true;
                let folded = 0;
                const fits = () => bar.scrollWidth <= bar.clientWidth + 1;
                while (!fits() && folded < shown.length - 1) {
                    const each = shown[folded];
                    each.crumb.hidden = true;
                    if (each.separator) each.separator.hidden = true;
                    // The first part after the fold takes no separator of its own: the "…" has one.
                    const next = shown[folded + 1];
                    if (next.separator) next.separator.hidden = true;
                    more.hidden = moreSeparator.hidden = false;
                    folded++;
                }
                if (folded) {
                    const hidden = shown
                        .slice(0, folded)
                        .map((each) => each.part)
                        .reverse();
                    more.dataset.crumb = hidden[0].key;
                    more.addEventListener('click', () =>
                        ui.menu({
                            items: hidden.map((part) => ({
                                label: part.label,
                                ...(part.icon ? { icon: part.icon } : {}),
                                run: () => onGo?.(part.key),
                            })),
                            anchor: more,
                        })
                    );
                }
                if (!fits() && shown.length) shown.at(-1).crumb.dataset.shrinks = '';
            };
            // The same parts again are left as drawn: a redraw would replace the button under a press, or the "…" a menu
            // hangs from.
            const set = (next) => {
                parts = next || [];
                const key = JSON.stringify(
                    parts.map((part) => [part.key, part.label, part.title || '', !!part.current, part.icon || ''])
                );
                if (key === drawn) return;
                drawn = key;
                draw();
            };
            // Folding is measured, so the bar draws again when its room changes.
            new ResizeObserver(() => {
                if (bar.clientWidth === width) return;
                width = bar.clientWidth;
                if (parts.length) draw();
            }).observe(bar);
            return { element: bar, set };
        }

        function tag(name, className) {
            const made = document.createElement(name);
            made.className = className;
            return made;
        }

        return { STYLE, make };
    }
);
