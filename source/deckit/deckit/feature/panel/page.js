DeckitModule.define(
    'deckit/feature/panel/page',
    {
        uses: [
            'deckit/ui/color',
            'deckit/service/keymap/page',
            'deckit/feature/panel/sidebar',
            'deckit/feature/panel/protocol',
            'deckit/service/keymap/model/binding-id',
        ],
        provides: ['mount'],
    },
    (COLOR, KEYMAP, SIDEBAR, PROTOCOL, BINDING_ID) => {
        // MARK: - Property

        // MARK: - Initializer
        // MARK: - Public
        // The panel's frame around one plugin's parts, in its own page. `tell` calls a part of the plugin (didAppear,
        // didDisappear).
        function mount({ theme, ui, parts, tell }) {
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
            // Where the window's title bar lies over the panel, when the panel shares the window's top with it: a band
            // across the panel that drags the window wherever nothing is drawn over it, and over the content the strip
            // that names the plugin on screen, which leaves the window's buttons room when the sidebar is collapsed.
            const dragBand = element('div', {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                display: 'none',
                webkitAppRegion: 'drag',
            });
            const titleStrip = element('div', {
                flex: '0 0 auto',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                font: '600 ' + theme.type.body,
                color: theme.color.muted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                webkitAppRegion: 'drag',
                transition: `padding-left ${MOTION.base}ms ${MOTION.easing}`,
            });
            Object.assign(parts.content.style, { width: '100%', flex: '1 1 auto', minHeight: '0' });
            content.append(titleStrip, parts.content);
            const sidebar = SIDEBAR.make({
                theme,
                ui,
                root,
                content,
                sidebar: parts.sidebar || null,
                onPick: (id) => PROTOCOL.pick.send({ id }),
                onStep: (by) => PROTOCOL.step.send({ by }),
                onReorder: (ids) => PROTOCOL.reorder.send({ ids }),
                onLayout: (change) => PROTOCOL.layout.send(change),
                onCollapsedChange: () => dress(),
                chordOf: (action) => KEYMAP.chord(BINDING_ID.idOf(BINDING_ID.DECKIT_OWNER, action)),
            });
            root.append(dragBand, sidebar.element, content);
            document.body.appendChild(root);
            dress();
            showState(setup.state, false);
            appear();

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

            // The strip names the plugin on screen, as the panel's title does.
            function showState(state, animate) {
                sidebar.show(state, animate);
                titleStrip.textContent = state.plugins.find(({ id }) => id === state.current)?.name || '';
            }

            // didAppear and didDisappear alternate, worked out in this one place.
            function appear() {
                if (open === appeared) return;
                appeared = open;
                tell(open ? 'didAppear' : 'didDisappear');
            }

            // Floating over an app, the ring makes the panel read as on top and the rounding needs the page behind
            // to be clear. Filling a window, the frame is the OS's, and the panel may share the window's top with its
            // title bar: the sidebar reaches up under it and the content keeps below it.
            function dress() {
                const bar = look.titleBar;
                Object.assign(dragBand.style, { display: bar ? 'block' : 'none', height: (bar?.height || 0) + 'px' });
                Object.assign(titleStrip.style, {
                    display: bar ? 'flex' : 'none',
                    height: (bar?.height || 0) + 'px',
                    paddingLeft: bar && sidebar.collapsed() ? bar.controlsWidth + 'px' : '0',
                });
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

        // MARK: - Private
        function element(tag, style) {
            const made = document.createElement(tag);
            Object.assign(made.style, style);
            return made;
        }

        return { mount };
    }
);
