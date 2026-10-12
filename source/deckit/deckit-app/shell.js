DeckitModule.define(
    'app/shell',
    {
        uses: ['app/window'],
        provides: ['make'],
        runs: 'main',
    },
    (WINDOW) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // Deckit on its own: the panel always in a window of its own, the switcher in front of it.
        function make({ restart }) {
            const state = { window: null, opening: null, title: '' }; // `opening`: a second reveal waits on it
            let deck = null;
            let switcher = null;

            function live(window) {
                return window && !window.isDestroyed() ? window : null;
            }

            // The Dock can ask before deckit has started the shell, which shows the panel itself as it starts. The
            // panel plays its exit as it leaves wherever it was and its entrance in the window.
            function reveal() {
                if (!deck) return Promise.resolve(null);
                const open = live(state.window);
                if (open) {
                    raise(open);
                    return Promise.resolve(open);
                }
                if (state.opening) return state.opening;
                state.opening = deck.panel
                    .leave()
                    .then((left) => {
                        if (!left) return null;
                        state.window = openWindow({
                            view: deck.panel.view(),
                            title: state.title,
                            glass: true,
                            name: 'panel',
                            onClose: () => {
                                state.window = null;
                                deck.panel.hide();
                            },
                        });
                        deck.panel.present({ floating: false, dismissible: false });
                        deck.panel.arrive();
                        return state.window;
                    })
                    .finally(() => (state.opening = null));
                return state.opening;
            }

            // Every window here is Deckit.app's, and a keystroke on its bar is heard like one in its pages.
            function openWindow(options) {
                const window = WINDOW.open({ ...options, place: deck.window.place });
                deck.keymap.listen(window.webContents);
                return window;
            }

            function raise(window) {
                if (window.isMinimized()) window.restore();
                window.show();
                window.focus();
            }

            // The panel's views and the switcher's are in the panel's window, which only this shell knows.
            function windowOf(webContents) {
                if (deck.panel.contains(webContents) || webContents === switcher?.webContents)
                    return live(state.window);
                return require('electron').BrowserWindow.fromWebContents(webContents);
            }

            // A second press closes it. It took the keyboard as it opened, so the panel takes it back.
            function summonSwitcher(webContents) {
                const window = windowOf(webContents);
                const here = deck.switcher.shown();
                deck.switcher.close();
                if (here || !window || window !== live(state.window)) return;
                switcher = deck.switcher.view();
                deck.window.place(switcher, window, {
                    bounds: WINDOW.area,
                    front: true,
                    onClose: () => deck.switcher.close(),
                });
                deck.switcher.open().then((closed) => closed && deck.panel.shown() && deck.panel.focus());
            }

            return {
                start: (given) => {
                    deck = given;
                    reveal();
                },
                showsPanel: (webContents) => {
                    if (webContents === switcher?.webContents) return false;
                    const window = windowOf(webContents);
                    return !!window && window === live(state.window) && !deck.switcher.shown();
                },
                reveal: () => void reveal(),
                // The panel is always presented as not dismissible here, so Escape never asks this.
                dismiss: () => {},
                summonSwitcher,
                openWindow,
                panelTitled: (title) => {
                    state.title = title;
                    if (live(state.window)) WINDOW.setTitle(state.window, title);
                },
                noticeClicked: () => void reveal(),
                restart,
            };
        }

        // MARK: - Private

        return { make };
    }
);
