DeckitModule.define(
    'deckit/feature/app/page',
    {
        uses: ['deckit/service/deck/page', 'deckit/feature/app/protocol', 'deckit/service/deck/model/origin'],
        provides: ['boot'],
    },
    (RUNTIME, PROTOCOL, ORIGIN) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The entry of every page deckit makes: a mod's, or one the UI made. `before` is the globals the page had
        // before deckit's bundles ran: what they added goes, the registry first, so a mod reaches deckit only through
        // what it is handed. `ui` is the UI on deck, if one is: `page(name)` draws a page it made, and `mod` is what it
        // gives each mod (service/deck/page). Nothing starts off deckit's scheme: the preload runs on an error page too,
        // which is no mod's.
        function boot(before, ui = null) {
            for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
            if (location.protocol !== ORIGIN.SCHEME.scheme + ':') return;
            if (document.readyState === 'loading')
                document.addEventListener('DOMContentLoaded', () => start(ui), { once: true });
            else start(ui);
        }

        // MARK: - Private
        function start(ui) {
            const { page } = PROTOCOL.setup.invoke();
            if (page) ui?.page(page);
            else RUNTIME.start({ ui: ui?.mod || null });
        }

        return { boot };
    }
);
