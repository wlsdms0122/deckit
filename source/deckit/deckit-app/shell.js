DeckitModule.define(
    'app/shell',
    {
        uses: ['deckit/config'],
        provides: ['make'],
        runs: 'main',
    },
    (CONFIG) => {
        // MARK: - Property
        const KEY = 'panel';

        // MARK: - Initializer
        // MARK: - Public
        // Deckit on its own: the panel always in a window of its own, the switcher in front of it.
        function make({ restart }) {
            const state = { window: null, opening: null }; // `opening`: a second reveal waits on the open in progress
            let deck = null;
            let switcher = null;

            function live(window) {
                return window && !window.isDestroyed() ? window : null;
            }

            // The Dock can ask before deckit has started the shell, which shows the panel itself as it starts.
            function reveal() {
                if (!deck) return Promise.resolve(null);
                const open = live(state.window);
                if (open) {
                    deck.window.raise(open);
                    return Promise.resolve(open);
                }
                if (state.opening) return state.opening;
                state.opening = deck.panel
                    .presentInWindow({
                        key: KEY,
                        title: CONFIG.name,
                        boundsKey: 'window',
                        onClose: () => {
                            state.window = null;
                            deck.panel.hide();
                        },
                    })
                    .then((window) => (state.window = live(window)))
                    .finally(() => (state.opening = null));
                return state.opening;
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
                deck.window.place(switcher, window, { front: true, onClose: () => deck.switcher.close() });
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
                noticeClicked: () => void reveal(),
                restart,
            };
        }

        // MARK: - Private

        return { make };
    }
);
