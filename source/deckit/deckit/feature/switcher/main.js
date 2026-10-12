DeckitModule.define(
    'deckit/feature/switcher/main',
    {
        uses: [
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/keymap/main',
            'deckit/service/switcher/main',
            'deckit/feature/panel/main',
            'deckit/feature/switcher/protocol',
        ],
        provides: ['start', 'deck'],
    },
    (LOG, IDENTITY, KEYMAP, SWITCHER, PANEL, PROTOCOL) => {
        // MARK: - Property
        const state = { view: null, on: false, ready: false, closed: null }; // `closed` resolves the open in progress
        let makeView = null;

        // MARK: - Initializer
        // MARK: - Public
        function start({ makeView: make, shell }) {
            makeView = make;
            KEYMAP.register({
                action: 'switcher',
                key: 'mod+shift+g',
                label: 'Quick switcher',
                global: true,
                run: (webContents) => shell.summonSwitcher(PANEL.viewFor(webContents) || webContents),
            });
            SWITCHER.start({ list: () => state.view?.webContents || null, reveal: PANEL.reveal });
            PROTOCOL.ready.on((_payload, sender) => {
                if (sender !== state.view?.webContents) return;
                state.ready = true;
                // A chord that came while the page was loading is answered now instead of lost.
                if (state.on) PROTOCOL.open.send(sender, {});
            });
            PROTOCOL.close.on((_payload, sender) => sender === state.view?.webContents && close());
        }

        // Resolves true when put away (the keyboard is the shell's to give back), false when it never opened or was
        // opened again during its exit.
        function open() {
            return new Promise((resolve) => {
                const view = build();
                state.closed?.(false);
                state.closed = resolve;
                state.on = true;
                view.setVisible(true);
                view.webContents.focus();
                if (state.ready) PROTOCOL.open.send(view.webContents, {});
            });
        }

        // Hidden only after the page has played its exit. Opened again during it, it stays up.
        function close() {
            if (!state.on) return;
            state.on = false;
            const closed = state.closed;
            state.closed = null;
            const contents = state.view.webContents;
            const token = PANEL.awaitReply(contents, PROTOCOL.hidden, () => {
                if (state.on) return closed?.(false);
                state.view?.setVisible(false);
                closed?.(true);
            });
            PROTOCOL.dismiss.send(contents, { token });
        }

        // MARK: - Private
        // Made the first time it is asked for. A page that reloads (a theme change reloads it) cannot hold an open list.
        function build() {
            if (state.view) return state.view;
            const view = makeView(IDENTITY.SWITCHER_ORIGIN, { webview: false });
            const contents = view.webContents;
            IDENTITY.add(contents, { switcher: true });
            KEYMAP.listen(contents, {
                keys: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({
                    key: 'mod+' + number,
                    run: () => PROTOCOL.number.send(contents, { number }),
                })),
            });
            LOG.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`switcher: ${message}`)
            );
            LOG.guard(contents, 'did-start-loading', () => {
                const was = state.ready;
                state.ready = false;
                // Only a page that was up: the first load starts after the first open, which must stay open.
                if (was) drop();
            });
            LOG.guard(
                contents,
                'destroyed',
                () => {
                    drop();
                    state.view = null;
                    state.ready = false;
                },
                { once: true }
            );
            view.setVisible(false);
            contents.loadURL(IDENTITY.SWITCHER_ORIGIN + '/');
            state.view = view;
            return view;
        }

        // For a page that is going: there is no exit to wait for.
        function drop() {
            if (!state.on) return;
            state.on = false;
            state.view?.setVisible(false);
            const closed = state.closed;
            state.closed = null;
            closed?.(true);
        }

        return {
            start,
            deck: {
                view: build,
                open,
                close,
                shown: () => state.on,
            },
        };
    }
);
