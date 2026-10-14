DeckitModule.define(
    'host/shell',
    {
        uses: ['host/window'],
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
            let deckit = null;
            let switcher = null;

            function live(window) {
                return window && !window.isDestroyed() ? window : null;
            }

            // The Dock can ask before deckit has started the shell, which shows the panel itself as it starts. The
            // panel plays its exit as it leaves wherever it was and its entrance in the window.
            function reveal() {
                if (!deckit) return Promise.resolve(null);
                const open = live(state.window);
                if (open) {
                    raise(open);
                    return Promise.resolve(open);
                }
                if (state.opening) return state.opening;
                state.opening = deckit.panel
                    .leave()
                    .then((left) => {
                        if (!left) return null;
                        const view = deckit.panel.view();
                        const onClose = () => {
                            state.window = null;
                            deckit.panel.hide();
                        };
                        state.window = WINDOW.open({
                            view,
                            title: state.title,
                            glass: deckit.panel.glass,
                            fullSize: true,
                            key: 'panel',
                            place: (window, { bounds }) => deckit.window.place(view, window, { bounds, onClose }),
                            focus: focusPanel,
                        });
                        deckit.panel.present({ floating: false, dismissible: false, titleBar: WINDOW.titleBar });
                        deckit.panel.arrive();
                        return state.window;
                    })
                    .finally(() => (state.opening = null));
                return state.opening;
            }

            // What has the keyboard in the panel's window: the switcher while it is open, or else the panel.
            function focusPanel() {
                if (deckit.switcher.shown()) switcher?.webContents.focus();
                else if (deckit.panel.shown()) deckit.panel.focus();
            }

            function raise(window) {
                if (window.isMinimized()) window.restore();
                window.show();
                window.focus();
            }

            // The panel's views and the switcher's are in the panel's window, which only this shell knows.
            function windowOf(webContents) {
                if (deckit.panel.contains(webContents) || webContents === switcher?.webContents)
                    return live(state.window);
                return require('electron').BrowserWindow.fromWebContents(webContents);
            }

            // A second press closes it. It took the keyboard as it opened, so the panel takes it back. It covers the
            // whole window, the bar too, so its scrim dims all of it.
            function summonSwitcher(webContents) {
                const window = windowOf(webContents);
                const here = deckit.switcher.shown();
                deckit.switcher.close();
                if (here || !window || window !== live(state.window)) return;
                switcher = deckit.switcher.view();
                deckit.window.place(switcher, window, {
                    front: true,
                    onClose: () => deckit.switcher.close(),
                });
                deckit.switcher.open().then((closed) => closed && deckit.panel.shown() && deckit.panel.focus());
            }

            return {
                start: (given) => {
                    deckit = given;
                    reveal();
                },
                showsPanel: (webContents) => {
                    if (webContents === switcher?.webContents) return false;
                    const window = windowOf(webContents);
                    return !!window && window === live(state.window) && !deckit.switcher.shown();
                },
                reveal: () => void reveal(),
                // The panel is always presented as not dismissible here, so Escape never asks this.
                dismiss: () => {},
                summonSwitcher,
                // Deckit's own windows: a mod's, a web page's, a popup's.
                openWindow: (options) => WINDOW.open(options),
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
