DeckitModule.define(
    'shell/feature/panel/page',
    {
        uses: ['shell/ui/color', 'shell/feature/panel/sidebar', 'shell/feature/panel/protocol'],
        provides: ['mount', 'show', 'viewProblem', 'keyProblem'],
    },
    (COLOR, SIDEBAR, PROTOCOL) => {
        // MARK: - Property

        // MARK: - Initializer
        // MARK: - Public
        // The panel's frame around one mod's view, in its own page. `tell` calls a part of the view (didAppear,
        // didDisappear); `layers` is what floats in the page; `chordOf(action)` is the chord of one of the panel's keys.
        function mount({ theme, ui, view, tell, layers, chordOf }) {
            const setup = PROTOCOL.setup.invoke();
            const { motion: MOTION } = theme;
            let open = setup.shown;
            let look = setup.look;
            let leaving = null;
            let appeared = false;

            // So what the browser draws itself (scrollbars, native controls) follows the theme.
            document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light';
            const root = element('div', {
                position: 'fixed',
                inset: '0',
                display: 'flex',
                overflow: 'hidden',
                flexDirection: 'row',
                font: '15px ' + theme.font,
                boxSizing: 'border-box',
            });
            const content = element('div', {
                flex: '1 1 auto',
                minWidth: '0',
                background: 'transparent',
                color: theme.color.text,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
            });
            Object.assign(view.content.style, { width: '100%', flex: '1 1 auto', minHeight: '0' });
            content.append(view.content);
            // Where the window's buttons stand is the panel's, whatever is drawn there: it drags the window, so the
            // window can be moved however the mod on screen draws its top. Last, so a region the mod keeps from dragging
            // does not take it back.
            const buttonsRoom = element('div', {
                position: 'absolute',
                top: '0',
                left: '0',
                display: 'none',
                webkitAppRegion: 'drag',
            });
            const sidebar = SIDEBAR.make({
                theme,
                ui,
                root,
                content,
                sidebar: view.sidebar || null,
                onPick: (id) => PROTOCOL.pick.send({ id }),
                onStep: (by) => PROTOCOL.step.send({ by }),
                onReorder: (ids) => PROTOCOL.reorder.send({ ids }),
                onLayout: (change) => PROTOCOL.layout.send(change),
                onCollapsedChange: () => dress(),
                chordOf,
            });
            root.append(sidebar.element, content, buttonsRoom);
            document.body.appendChild(root);
            dress();
            showState(setup.state, false);
            appear();

            layers.onChange((on) => PROTOCOL.floating.send({ on }));
            // Main took this Escape, so the field never saw it: it is played again as a keydown. A field that handles
            // it keeps the caret; one that does not is left, as a browser would, so the next Escape reaches the page.
            PROTOCOL.escape.on(({ last }) => {
                const top = layers.top();
                if (top) return top.dismiss();
                const field = document.activeElement;
                if (isField(field)) {
                    const handled = !field.dispatchEvent(
                        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
                    );
                    if (!handled && document.activeElement === field) field.blur();
                    return;
                }
                if (last) PROTOCOL.hide.send();
            });
            PROTOCOL.state.on((state) => showState(state, true));
            PROTOCOL.look.on((next) => {
                look = next;
                dress();
            });
            PROTOCOL.visible.on(({ open: on, token, animate }) => {
                if (open === on) return;
                open = on;
                appear();
                if (!animate) {
                    if (on) showAtOnce();
                    return;
                }
                if (on) fadeIn();
                else fadeOut(() => !open && PROTOCOL.hidden.send({ token }));
            });
            // Main waits for the exit before it moves the panel, so a move is not seen as a flicker.
            PROTOCOL.play.on(({ direction, token }) => {
                if (direction === 'out') fadeOut(() => PROTOCOL.played.send({ token }));
                else fadeIn();
            });

            function showState(state, animate) {
                sidebar.show(state, animate);
            }

            // didAppear and didDisappear alternate, worked out in this one place.
            function appear() {
                if (open === appeared) return;
                appeared = open;
                tell(open ? 'didAppear' : 'didDisappear');
            }

            // Floating over an app, the ring makes the panel read as on top and the rounding needs the page behind
            // to be clear. Filling a window, the frame is the OS's, and the panel may share the window's top with its
            // title bar: the sidebar reaches up under it, and so does the content, whose title bar area is the mod's
            // (`ui.titleBar`): as tall as the bar, from past the window's buttons when the sidebar is collapsed.
            function dress() {
                const bar = look.titleBar;
                document.documentElement.toggleAttribute('data-deckit-title-bar', !!bar);
                Object.assign(buttonsRoom.style, {
                    display: bar ? 'block' : 'none',
                    width: (bar?.controlsWidth || 0) + 'px',
                    height: (bar?.height || 0) + 'px',
                });
                const page = document.documentElement.style;
                page.setProperty('--deckit-title-bar-area-height', (bar?.height || 0) + 'px');
                page.setProperty(
                    '--deckit-title-bar-area-x',
                    (bar && sidebar.collapsed() ? bar.controlsWidth : 0) + 'px'
                );
                sidebar.setTitleBarHeight(bar?.height || 0);
                Object.assign(
                    root.style,
                    { background: COLOR.alpha(theme.color.background, setup.glass), boxShadow: 'none' },
                    look.floating
                        ? {
                              border: '1px solid rgba(255,255,255,.14)',
                              borderRadius: '12px',
                              transformOrigin: 'center',
                              transition: `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`,
                          }
                        : { border: '0', borderRadius: '0', opacity: '1', transform: 'none', transition: 'none' }
                );
            }

            // An entrance cancels an exit under way, so a quick close, open and close never reports the first exit done.
            function fadeIn() {
                clearTimeout(leaving);
                leaving = null;
                root.style.transition = 'none';
                root.style.opacity = '0';
                root.style.transform = MOTION.entrance;
                requestAnimationFrame(() => {
                    root.style.transition = `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
                    root.style.opacity = '1';
                    root.style.transform = 'none';
                });
            }

            // A view that faded out while it was on screen comes back where it stood.
            function showAtOnce() {
                clearTimeout(leaving);
                leaving = null;
                root.style.transition = 'none';
                root.style.opacity = '1';
                root.style.transform = 'none';
            }

            function fadeOut(then) {
                root.style.transition = `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
                root.style.opacity = '0';
                root.style.transform = MOTION.entrance;
                clearTimeout(leaving);
                const duration = MOTION.base;
                if (!duration) return then();
                leaving = setTimeout(() => {
                    leaving = null;
                    then();
                }, duration);
            }
        }

        // The mod asks to be on screen.
        function show() {
            PROTOCOL.show.send();
        }

        // Why what `deck.view` was handed is not a view, or ''.
        function viewProblem(value) {
            return value?.content?.nodeType === Node.ELEMENT_NODE
                ? ''
                : 'takes { content, sidebar, didAppear, didDisappear }, content an element';
        }

        // A mod's own key runs only in its page in front, so one with no view has only its global keys.
        function keyProblem(key, view) {
            return !key.global && !view ? 'a mod with no view is never in front, so only a global key does' : '';
        }

        // MARK: - Private
        function isField(element) {
            return !!element?.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
        }

        function element(tag, style) {
            const made = document.createElement(tag);
            Object.assign(made.style, style);
            return made;
        }

        return { mount, show, viewProblem, keyProblem };
    }
);
