DeckitModule.define(
    'deckit/feature/switcher/main',
    {
        uses: [
            'deckit/module/log',
            'deckit/service/keymap/server',
            'deckit/feature/panel/main',
            'deckit/feature/switcher/model/protocol',
        ],
        provides: ['deck', 'page'],
    },
    (log, KEYMAP, PANEL, PROTOCOL) => {
        const { guard } = log;

        // `closed` resolves the open in progress.
        const switcher = { view: null, wc: null, on: false, ready: false, closed: null };

        const toSwitcher = (end, payload) => {
            if (switcher.wc) end.send(switcher.wc, payload);
        };
        // Only the switcher's page speaks for it.
        const fromSwitcher = (fn) => (payload, sender) => {
            if (sender === switcher.wc) fn(payload);
        };

        PROTOCOL.ready.hear(
            fromSwitcher(() => {
                switcher.ready = true;
                // A chord that arrived while the page was still loading is answered now instead of lost.
                if (switcher.on) toSwitcher(PROTOCOL.open);
            })
        );
        PROTOCOL.close.hear(fromSwitcher(() => close()));

        // For a page that is going: there is no exit to wait for.
        const drop = () => {
            if (!switcher.on) return;
            switcher.on = false;
            try {
                switcher.view?.setVisible(false);
            } catch {}
            const closed = switcher.closed;
            switcher.closed = null;
            closed?.(true);
        };

        // A page that reloads (a theme change reloads both) cannot hold an open switcher.
        const build = () => {
            if (switcher.view) return switcher.view;
            const view = PANEL.pageView('switcher');
            if (!view) return null;
            switcher.view = view;
            switcher.wc = view.webContents;
            // Only a page that was up: the first load starts after the first open, which must stay open.
            guard(view.webContents, 'did-start-loading', () => {
                const was = switcher.ready;
                switcher.ready = false;
                if (was) drop();
            });
            guard(view.webContents, 'destroyed', () => {
                drop();
                switcher.view = null;
                switcher.wc = null;
                switcher.ready = false;
            });
            return view;
        };

        /* Resolves true when put away (the keyboard is the shell's to give back), false when it never
     opened or was opened again during the exit. Without a panel page there are no entries to list. */
        const open = () =>
            new Promise((resolve) => {
                if (!PANEL.page() || !build()) {
                    resolve(false);
                    return;
                }
                switcher.closed?.(false);
                switcher.closed = resolve;
                switcher.on = true;
                switcher.view.setVisible(true);
                try {
                    switcher.wc.focus();
                } catch {}
                if (switcher.ready) toSwitcher(PROTOCOL.open);
            });

        const close = () => {
            if (!switcher.on) return;
            switcher.on = false;
            const closed = switcher.closed;
            switcher.closed = null;
            /* Hidden only after the page has played its exit. Opened again during the exit, it stays up
       and the open that ended here resolves false. */
            const token = PANEL.awaitPage(switcher.wc, PROTOCOL.hidden, () => {
                if (switcher.on) {
                    closed?.(false);
                    return;
                }
                try {
                    switcher.view?.setVisible(false);
                } catch {}
                closed?.(true);
            });
            toSwitcher(PROTOCOL.dismiss, { token });
        };

        return Object.freeze({
            page: () => switcher.wc,
            deck: Object.freeze({
                view: build,
                open,
                close,
                shown: () => switcher.on,
                chord: () => KEYMAP.globalSpec('host.switcher'),
            }),
        });
    }
);
