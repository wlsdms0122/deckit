DeckitModule.define(
    'deckit/service/switcher/server',
    {
        uses: ['deckit/service/switcher/model/protocol'],
        provides: ['connect'],
    },
    (PROTOCOL) => {
        let pages = { sources: () => null, list: () => null };

        const to = (page, end, payload) => {
            const wc = page();
            if (wc && !wc.isDestroyed()) end.send(wc, payload);
        };
        // Every page of deckit's shares one preload, so each leg checks its sender.
        const from = (page, fn) => (payload, sender) => {
            if (sender === page()) fn(payload);
        };
        const fromList = (fn) => from(() => pages.list(), fn);
        const fromSources = (fn) => from(() => pages.sources(), fn);

        /* A need that comes before the panel's page listens is held and asked once it does: a theme change
     reloads both pages and the switcher's is up first, and a collect sent to a document still loading
     is lost, leaving the switcher waiting on nothing. */
        let answering = null; // the panel's webContents, while its document listens
        let waiting = false;
        const watched = new WeakSet();
        PROTOCOL.listening.hear(
            fromSources(() => {
                const wc = pages.sources();
                answering = wc;
                if (!watched.has(wc)) {
                    watched.add(wc);
                    const gone = () => {
                        if (answering === wc) answering = null;
                    };
                    wc.on('did-start-navigation', (details) => {
                        if (details?.isMainFrame && !details.isSameDocument) gone();
                    });
                    wc.once('destroyed', gone);
                }
                if (waiting) {
                    waiting = false;
                    to(pages.sources, PROTOCOL.collect);
                }
            })
        );
        PROTOCOL.need.hear(
            fromList(() => {
                if (answering && answering === pages.sources()) to(pages.sources, PROTOCOL.collect);
                else waiting = true;
            })
        );
        PROTOCOL.query.hear(fromList(({ raw, page }) => to(pages.sources, PROTOCOL.search, { raw, page })));
        PROTOCOL.pick.hear(fromList(({ id }) => to(pages.sources, PROTOCOL.run, { id })));

        PROTOCOL.offer.hear(fromSources(({ items, now }) => to(pages.list, PROTOCOL.supply, { items, now })));
        PROTOCOL.offerNow.hear(fromSources(({ rows }) => to(pages.list, PROTOCOL.now, { rows })));
        PROTOCOL.found.hear(
            fromSources(({ raw, entries, page }) => to(pages.list, PROTOCOL.resolved, { raw, entries, page }))
        );

        return {
            connect: ({ sources, list }) => {
                pages = { sources, list };
            },
        };
    }
);
