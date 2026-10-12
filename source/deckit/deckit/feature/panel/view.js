DeckitModule.define(
    'deckit/feature/panel/view',
    {
        uses: [
            'deckit/ui/color',
            'deckit/service/keymap/view',
            'deckit/feature/panel/sidebar',
            'deckit/feature/panel/protocol',
        ],
        provides: ['mount'],
    },
    (COLOR, KEYMAP, SIDEBAR, PROTOCOL) => {
        // MARK: - Property
        // The panel is glass: its colour at this strength, with what is behind it blurred through.
        const GLASS_OPACITY = 0.68;
        const OWNER = '@deckit';

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
            });
            Object.assign(parts.content.style, { width: '100%', height: '100%' });
            content.appendChild(parts.content);
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
                chordOf: (action) => KEYMAP.chord(`${OWNER}.${action}`),
            });
            root.append(sidebar.element, content);
            document.body.appendChild(root);
            dress();
            sidebar.show(setup.state, false);
            appear();

            PROTOCOL.state.on((state) => sidebar.show(state, true));
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

            // didAppear and didDisappear alternate, worked out in this one place.
            function appear() {
                if (open === appeared) return;
                appeared = open;
                tell(open ? 'didAppear' : 'didDisappear');
            }

            // Floating over an app, the ring makes the panel read as on top and the rounding needs the page behind
            // to be clear. Filling a window, the frame is the OS's.
            function dress() {
                Object.assign(
                    root.style,
                    { background: COLOR.alpha(theme.color.background, GLASS_OPACITY), boxShadow: 'none' },
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
