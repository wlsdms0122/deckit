function createApp({ WINDOW, THEME }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit on its own: the desktop in a window of its own, the host window, and each overlay window of a mod in one
    // of its own, floating over every app.
    function make({ restart }) {
        // `windows`: each overlay window's host window, by its control
        const state = { window: null, title: '', windows: new Map() };
        let controls = null; // what the host drives of the shell, handed as it starts

        function live(window) {
            return window && !window.isClosed() ? window : null;
        }

        // The host window comes up, opened again where it was closed. The Dock can ask before the shell has started,
        // which shows it itself as it starts.
        function show() {
            if (!controls) return;
            if (live(state.window)) {
                state.window.show({ focus: true });
                return;
            }
            const { desktop } = controls;
            state.window = WINDOW.open({
                title: state.title,
                glass: desktop.glass,
                fullSize: true,
                key: 'desktop',
                place: (window) =>
                    desktop.place(window, {
                        onClose: () => {
                            state.window = null;
                            desktop.hide();
                        },
                    }),
                focus: () => desktop.shown() && desktop.focus(),
            });
            desktop.present({ titleBar: WINDOW.titleBar });
            desktop.show();
        }

        // An overlay window floats over whichever app is in front, on the screen the pointer is on, and tells the
        // mod as the keyboard leaves it and the shell where the person moves it. It opens where the shell kept that
        // window of the mod as last left, at the size the mod gives it now.
        function showWindow(control, { activates = true } = {}) {
            const window = hostWindowOf(control);
            WINDOW.setViewSize(window, control);
            WINDOW.float(window, { activates, kept: control.keptFrame });
        }

        function hostWindowOf(control) {
            const open = live(state.windows.get(control));
            if (open) return open;
            const window = WINDOW.openFloating({
                size: { width: control.width, height: control.height },
                place: (window) => control.place(window),
                focus: control.focus,
                blur: control.didResignKey,
                didMove: control.didMove,
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
            show,
            showWindow,
            closeWindow: (control) => {
                const window = live(state.windows.get(control));
                state.windows.delete(control);
                window?.close();
            },
            // A web page's window is one on the desktop, which the shell lays.
            openWindow: (options) => controls.openWindow(options),
            desktopTitled: (title) => {
                state.title = title;
                if (live(state.window)) WINDOW.setTitle(state.window, title);
            },
            notificationClicked: show,
            restart,
        };
    }

    // MARK: - Private

    return { make };
}

module.exports = { createApp };
