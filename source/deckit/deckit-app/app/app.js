function createApp({ WINDOW, THEME }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit on its own: the panel always in a window of its own, and a mod's window in one of its own, an overlay one
    // floating over every app.
    function make({ restart }) {
        // `opening`: a second show waits on it. `windows`: each mod's window, made as it is first shown, by deckit's
        // control of it
        const state = { window: null, opening: null, title: '', windows: new Map() };
        let controls = null; // what the host drives of the shell, handed as it starts

        function live(window) {
            return window && !window.isClosed() ? window : null;
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
                        place: (window) => controls.panel.place(window, { onClose }),
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
            window.show({ focus: true });
        }

        // An overlay opens floating over whichever app is in front, on the screen the pointer is on, and tells the mod
        // as the keyboard leaves it; another opens as Deckit.app's windows do, with its bar. Each opens where it was
        // last left, at the size the mod gives it now.
        function showWindow(control) {
            const window = modWindow(control);
            WINDOW.setViewSize(window, control);
            if (control.overlay) WINDOW.float(window);
            else raise(window);
        }

        function modWindow(control) {
            const open = live(state.windows.get(control));
            if (open) return open;
            const size = { width: control.width, height: control.height };
            const key = 'window-' + control.mod;
            const window = control.overlay
                ? WINDOW.openFloating({
                      size,
                      key,
                      place: (window) => control.place(window),
                      focus: control.focus,
                      blur: control.didResignKey,
                  })
                : WINDOW.open({
                      title: control.name,
                      size,
                      key,
                      place: (window) => control.place(window),
                      focus: control.focus,
                  });
            state.windows.set(control, window);
            return window;
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
            // The panel's pages are in the panel's window, while it is open.
            showsPanel: (page) => !!live(state.window) && controls.panel.contains(page),
            show: () => void show(),
            // The panel is always presented as not dismissible here, so Escape never asks this.
            dismiss: () => {},
            showWindow,
            hideWindow: (control) => live(state.windows.get(control))?.hide(),
            closeWindow: (control) => {
                const window = live(state.windows.get(control));
                state.windows.delete(control);
                window?.close();
            },
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
