function createApp({ WINDOW, THEME }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit on its own: the panel always in a window of its own, and the switcher in one of its own over every app.
    function make({ restart }) {
        // `opening`: a second show waits on it. `switcher`: the switcher's window, made as it is first summoned
        const state = { window: null, opening: null, title: '', switcher: null };
        let controls = null; // what the host drives of the shell, handed as it starts

        function live(window) {
            return window && !window.isDestroyed() ? window : null;
        }

        // The Dock can ask before the shell has started, which shows the panel itself as it starts. The
        // panel plays its exit as it leaves wherever it was and its entrance in the window.
        function show() {
            if (!controls) return Promise.resolve(null);
            const open = live(state.window);
            if (open) {
                raise(open);
                return Promise.resolve(open);
            }
            if (state.opening) return state.opening;
            state.opening = controls.panel
                .leave()
                .then((left) => {
                    if (!left) return null;
                    const onClose = () => {
                        state.window = null;
                        controls.panel.hide();
                    };
                    state.window = WINDOW.open({
                        title: state.title,
                        glass: controls.panel.glass,
                        fullSize: true,
                        key: 'panel',
                        place: (window, { bounds }) => controls.panel.place(window, { bounds, onClose }),
                        focus: focusPanel,
                    });
                    controls.panel.present({ floating: false, dismissible: false, titleBar: WINDOW.titleBar });
                    controls.panel.arrive();
                    return state.window;
                })
                .finally(() => (state.opening = null));
            return state.opening;
        }

        function focusPanel() {
            if (controls.panel.shown()) controls.panel.focus();
        }

        function raise(window) {
            if (window.isMinimized()) window.restore();
            window.show();
            window.focus();
        }

        // The panel's views are in the panel's window and the switcher's in its own, which only this host knows.
        function windowOf(webContents) {
            if (controls.panel.contains(webContents)) return live(state.window);
            if (controls.switcher.contains(webContents)) return live(state.switcher);
            return require('electron').BrowserWindow.fromWebContents(webContents);
        }

        // From anywhere, in Deckit.app or another app, over what is on the screen, which it leaves clear; a second
        // press closes it, as does the keyboard going elsewhere. Its window goes once its exit has played.
        function summonSwitcher() {
            if (!controls) return;
            const here = controls.switcher.shown();
            controls.switcher.close();
            if (here) return;
            const window = switcherWindow();
            controls.switcher.open({ dims: false }).then((closed) => closed && live(window)?.hide());
            WINDOW.float(window);
        }

        function switcherWindow() {
            if (live(state.switcher)) return state.switcher;
            state.switcher = WINDOW.openFloating({
                place: (window) => controls.switcher.place(window, { onClose: () => controls.switcher.close() }),
                focus: () => controls.switcher.focus(),
                blur: () => controls.switcher.close(),
            });
            return state.switcher;
        }

        return {
            start: (given) => {
                controls = given;
                controls.setTheme(THEME.now().theme);
                THEME.onChange(() => {
                    controls.setTheme(THEME.now().theme);
                    WINDOW.recolor();
                });
                show();
            },
            showsPanel: (webContents) => {
                if (controls.switcher.contains(webContents)) return false;
                const window = windowOf(webContents);
                return !!window && window === live(state.window) && !controls.switcher.shown();
            },
            show: () => void show(),
            // The panel is always presented as not dismissible here, so Escape never asks this.
            dismiss: () => {},
            summonSwitcher,
            // Deckit's own windows: a mod's, a web page's, a popup's.
            openWindow: (options) => WINDOW.open(options),
            panelTitled: (title) => {
                state.title = title;
                if (live(state.window)) WINDOW.setTitle(state.window, title);
            },
            notificationClicked: () => void show(),
            restart,
        };
    }

    // MARK: - Private

    return { make };
}

module.exports = { createApp };
