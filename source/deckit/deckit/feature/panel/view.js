DeckitModule.define(
    'deckit/feature/panel/view',
    {
        uses: [
            'deckit/service/home/model/config',
            'deckit/ui/token',
            'deckit/ui/kit',
            'deckit/service/keymap/client',
            'deckit/feature/panel/view/sidebar',
            'deckit/feature/panel/model/protocol',
        ],
        provides: ['register', 'start', 'reveal'],
    },
    (CONFIG, TOKEN, UI, KEYMAP, SB, PROTOCOL) => {
        // A screen's keys are not part of it: they are the keymap scope of the same id.
        const screens = []; // registration order, which is the order the column shows
        const screenOf = (id) => screens.find((s) => s.id === id) || null;
        const register = (screen = {}) => {
            if (!screen.id || screenOf(screen.id) || !screen.content)
                return console.warn('[deckit] a screen needs an id of its own and content', screen.id);
            screens.push(screen);
        };

        const { LIFT, MOTION, reducedMotion } = UI;
        // The floating stack (dialogs, menus) is the page's wiring, not the kit's: taken now, as it is gone once plugins run.
        const LAYERS = TOKEN.layers;
        const { isDark } = TOKEN;

        /* `open`: whether main has the view on screen; a chord of a panel nobody can see is the app's.
     `look`: { floating, dismissible }, how the shell presents it (feature/panel/main.js). */
        const state = {
            open: false,
            root: null,
            current: null,
            theme: null,
            look: { floating: false, dismissible: false },
        };

        // The one place the on-screen view is worked out, so didAppear and didDisappear alternate.
        let appeared = null;
        const tell = (id, name) => {
            try {
                screenOf(id)?.[name]?.();
            } catch (e) {
                console.warn("[deckit] a screen's " + name + ' threw', id, e);
            }
        };
        const appear = () => {
            const now = state.open ? state.current : null;
            if (now === appeared) return;
            const before = appeared;
            appeared = now;
            if (before) tell(before, 'didDisappear');
            if (now) tell(now, 'didAppear');
        };

        // The panel's own keys, live on every screen; a screen that binds the same chord wins.
        const chordOf = (id) => KEYMAP.chord(id);
        KEYMAP.register({
            id: 'host',
            name: CONFIG.name,
            everywhere: true,
            keys: {
                toggleSidebar: { key: 'mod+\\', label: 'Toggle sidebar', run: () => state.sidebar?.toggle() },
                back: { key: 'ctrl+mod+[', label: 'Back to the previous plugin', run: () => stepHistory(-1) },
                forward: { key: 'ctrl+mod+]', label: 'Forward to the next plugin', run: () => stepHistory(1) },
            },
        });

        /* Closed, every chord is the app's again. A chord waits while a dialog is up, so it cannot act
     on something behind the dialog. */
        let keys = null;
        const syncKeys = () => {
            if (!keys) return;
            const live = state.open ? KEYMAP.live(state.current) : [];
            keys.answer(
                live.map(({ id, chord, run }) => ({
                    id,
                    chord,
                    run: () => {
                        if (!LAYERS.count) run();
                    },
                }))
            );
            // Diagnostics only: preload runs in an isolated world and can read only the DOM.
            if (state.root) state.root.dataset.deckitKeys = live.map((k) => k.spec).join(',');
        };
        KEYMAP.on(() => syncKeys());

        /* Back and forward between plugins (⌃⌘[ ⌃⌘]), apart from each plugin's own history. In
     sessionStorage, so a reload of the panel comes back to it and a new start of the app does not. */
        const HISTORY_KEY = CONFIG.id + ':panel-history';
        const HISTORY_LIMIT = 50;
        const history = (() => {
            try {
                const kept = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || 'null');
                if (kept && Array.isArray(kept.list))
                    return { list: kept.list.filter((x) => typeof x === 'string'), at: kept.at | 0 };
            } catch {}
            return { list: [], at: -1 };
        })();
        const keepHistory = () => {
            try {
                sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            } catch {}
        };
        // Only once the plugins are up: what is no longer there is dropped.
        const restoreHistory = () => {
            const kept = [];
            let at = -1;
            history.list.forEach((id, i) => {
                // A place gone, or a repeat once the one between went, is dropped; its position passes to the one before.
                if (screenOf(id) && kept[kept.length - 1] !== id) kept.push(id);
                if (i === history.at) at = kept.length - 1;
            });
            history.list = kept;
            history.at = at < 0 ? kept.length - 1 : at;
        };
        const paintHistory = () => state.sidebar?.setHistory(history.at > 0, history.at < history.list.length - 1);
        const stepHistory = (by) => {
            const to = history.at + by;
            if (to < 0 || to >= history.list.length) return;
            history.at = to;
            keepHistory();
            selectPlugin(history.list[to], { fromHistory: true });
            paintHistory();
        };

        const slotParts = new Map(); // plugin id -> { holder, scrollTop }

        const selectPlugin = (id, { fromHistory = false } = {}) => {
            if (state.current === id) return;
            if (!screenOf(id)) return;
            if (!fromHistory) {
                history.list.splice(history.at + 1, Infinity, id);
                if (history.list.length > HISTORY_LIMIT) history.list.shift();
                history.at = history.list.length - 1;
                keepHistory();
                paintHistory();
            }

            // No fade: here it is a blank panel and then a fade, on the most repeated action in the panel.
            for (const screen of screens) screen.content.style.display = screen.id === id ? 'flex' : 'none';
            state.sidebar.setCurrent(id);

            // Hidden, not removed: taken out of the page, anything in it that scrolls comes back at the top.
            const slot = state.root.querySelector('.deckit__slot');
            const leaving = slotParts.get(state.current);
            if (leaving) {
                leaving.scrollTop = slot.scrollTop;
                leaving.holder.style.display = 'none';
            }
            const panel = screenOf(id)?.sidebar;
            let part = slotParts.get(id);
            if (panel && !part) {
                const holder = document.createElement('div');
                Object.assign(holder.style, { flexDirection: 'column', flex: '1 0 auto', minHeight: '0' });
                // Not shrunk, whatever the plugin set: the slot scrolls when a sidebar is taller than the room.
                panel.style.flexShrink = '0';
                holder.appendChild(panel);
                slot.appendChild(holder);
                part = { holder, scrollTop: 0 };
                slotParts.set(id, part);
            }
            if (part) part.holder.style.display = 'flex';
            slot.style.display = part ? 'flex' : 'none';
            slot.scrollTop = part?.scrollTop || 0;

            state.current = id;
            appear();
            syncKeys();
            nameDocument(id);
        };

        /* The window's bar reads the title and icon off this page. The glyph is drawn in currentColor,
     which means nothing in an image, so it gets the bar's colour; an image also needs the namespace. */
        const nameDocument = (id) => {
            const plugin = screenOf(id);
            document.title = plugin?.name || CONFIG.name;
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            const svg = String(plugin?.icon || '');
            if (!svg) {
                link.removeAttribute('href');
                return;
            }
            const ink = state.theme?.sidebarStrong || state.theme?.sidebarColor || '#d1d2d3';
            const image = /<svg[^>]*\sxmlns=/.test(svg)
                ? svg
                : svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
            link.href = 'data:image/svg+xml,' + encodeURIComponent(image.replace(/currentColor/g, ink));
        };

        const setInset = (px) => {
            try {
                document.documentElement.style.setProperty('--deckit-top-inset', px + 'px');
            } catch {}
        };

        /* Floating over an app, the ring makes the panel read as on top, and the transparent page behind
     lets the corners be round. Filling a window, the frame is the OS's. The panel is glass: its
     colour at this strength, with what is behind it blurred through. */
        const SHEET_OPACITY = 0.68;

        const applyChrome = (root, theme, look) => {
            const glass = UI.alpha(theme.contentBg, SHEET_OPACITY);
            Object.assign(
                root.style,
                {
                    // The same glass everywhere: what is under it is the shell's and the window's to add.
                    background: glass,
                    paddingTop: '0',
                    /* No shadow: the view's bounds are the panel, so any shadow lands in the corner notches the
         rounding leaves, and a spread one reads as a second outline. The shell's shade separates it. */
                    boxShadow: 'none',
                },
                !look.floating
                    ? {
                          border: '0',
                          borderRadius: '0',
                          opacity: '1',
                          transform: 'none',
                          transition: 'none',
                      }
                    : {
                          border: '1px solid rgba(255,255,255,.14)',
                          borderRadius: '12px',
                          transformOrigin: 'center',
                          transition: `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.base} ${MOTION.ease}`,
                      }
            );
        };

        const buildPanel = ({ theme, ui, onReorder }) => {
            // So what the browser draws itself (scrollbars, native controls) follows the theme.
            document.documentElement.style.colorScheme = isDark(theme.contentBg) ? 'dark' : 'light';
            state.ui = ui;
            state.theme = theme;

            const root = document.createElement('div');
            root.id = 'deckit-panel-root';
            // The root fills its view; where the view sits and its size are main's to apply.
            Object.assign(root.style, {
                position: 'fixed',
                inset: '0',
                display: 'flex',
                overflow: 'hidden',
                flexDirection: 'row',
                font: '15px ' + theme.font,
                boxSizing: 'border-box',
            });
            /* The window draws its bar, not the panel. `--deckit-top-inset` says how far it comes down, so
       a plugin drawing at its top edge can step out from under it. */
            setInset(0);
            PROTOCOL.bar.hear(({ inset }) => setInset(inset));
            applyChrome(root, theme, state.look);

            const content = document.createElement('div');
            Object.assign(content.style, {
                // Transparent: the root's glass shows through.
                flex: '1 1 auto',
                minWidth: '0',
                background: 'transparent',
                color: theme.contentColor,
                position: 'relative',
                display: 'flex',
            });

            const rows = [];
            for (const screen of screens) {
                Object.assign(screen.content.style, { display: 'none', width: '100%', height: '100%' });
                content.appendChild(screen.content);
                rows.push({ id: screen.id, name: screen.name, icon: screen.icon });
            }

            state.sidebar = SB.make({
                theme,
                ui,
                root,
                content,
                rows,
                onPick: selectPlugin,
                onBack: () => stepHistory(-1),
                onForward: () => stepHistory(1),
                onReorder: (ids) => onReorder?.(ids),
                chordOf,
            });
            paintHistory();

            root.append(state.sidebar.element, content);
            document.body.appendChild(root);
            state.root = root;
            restoreHistory();
            const kept = history.list[history.at];
            if (kept) {
                selectPlugin(kept, { fromHistory: true });
                paintHistory();
            } else if (screens[0]) selectPlugin(screens[0].id);
        };

        /* Asks main every time: only main knows what showing means where the panel is (in a window of
     its own it is already open), and it ignores a request with nothing to do. */
        const reveal = (pluginId) => {
            selectPlugin(pluginId);
            PROTOCOL.show.send();
        };

        /* Main holds the view on screen until `panel-hidden` says the exit has played. `leaving` is the
     exit under way, so an entrance cancels it; otherwise a quick close, open, close had the first
     exit report done mid-second, and main took the view away while it was still fading. */
        let leaving = null;

        const fadeIn = () => {
            const root = state.root;
            clearTimeout(leaving);
            leaving = null;
            if (!root) return;
            root.style.transition = 'none';
            root.style.opacity = '0';
            root.style.transform = LIFT;
            requestAnimationFrame(() => {
                root.style.transition = `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.base} ${MOTION.ease}`;
                root.style.opacity = '1';
                root.style.transform = 'none';
            });
        };

        const fadeOut = (then) => {
            const root = state.root;
            if (!root) return then?.();
            root.style.transition = `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.base} ${MOTION.ease}`;
            root.style.opacity = '0';
            root.style.transform = LIFT;
            const ms = parseFloat(MOTION.base) || 0;
            clearTimeout(leaving);
            if (ms)
                leaving = setTimeout(() => {
                    leaving = null;
                    then?.();
                }, ms);
            else then?.();
        };

        // `token` is main's number for the hide it is waiting on, echoed so the reply answers that hide only.
        const animateVisible = (open, token) => {
            if (!state.root) return;
            if (open) return fadeIn();
            fadeOut(() => {
                if (!state.open) PROTOCOL.hidden.send({ token });
            });
        };

        // Escape at its last stop (service/keymap/client.js), where main said the panel goes away there.
        const dismiss = () => {
            if (state.open) PROTOCOL.hide.send();
        };

        const wireIpc = () => {
            // Main waits for the exit before it re-parents the view, so a move is not seen as a flicker.
            PROTOCOL.play.hear(({ direction, token }) => {
                // Diagnostics only: preload runs in an isolated world and can read only the DOM.
                if (state.root) state.root.dataset.deckitPlay = direction + '@' + Date.now();
                if (direction === 'out') fadeOut(() => PROTOCOL.played.send({ token }));
                else fadeIn();
            });

            PROTOCOL.visible.hear(({ open, token }) => {
                if (state.open === open) return;
                state.open = open;
                syncKeys();
                appear();
                animateVisible(state.open, token);
            });

            PROTOCOL.look.hear((look) => {
                state.look = look;
                if (state.root && state.theme) applyChrome(state.root, state.theme, state.look);
            });
        };

        return {
            register,
            start({ theme, ui, shown = false, look = null, onReorder = null }) {
                if (state.root) return;
                state.open = !!shown;
                if (look) state.look = look;
                buildPanel({ theme, ui, onReorder });
                wireIpc();
                keys = KEYMAP.connect({ floating: TOKEN.layers, escape: dismiss });
                KEYMAP.publish();
                syncKeys();
                console.log('[deckit] panel up');
            },
            reveal,
        };
    }
);
