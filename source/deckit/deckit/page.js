DeckitModule.define(
    'deckit/page',
    {
        uses: [
            'deck/page',
            'deckit/mod/page',
            'deckit/protocol',
            'deck/sandbox/model/origin',
        ],
        provides: ['boot'],
    },
    (DECK, MOD, PROTOCOL, ORIGIN) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The entry of every page deckit makes: a mod's, or one the shell made. `before` is the globals the page had
        // before deckit's bundles ran: what they added goes, the registry first, so a mod reaches deckit only through
        // what it is handed. `shell` is the shell on deckit, if one is: `page(name)` draws a page it made, and `mod` is
        // what it gives each mod (feature/mod/page). Nothing starts off deckit's scheme: the preload runs on an error
        // page too, which is no mod's.
        function boot(before, shell = null) {
            for (const name of Object.keys(window)) if (!before.has(name)) delete window[name];
            if (location.protocol !== ORIGIN.SCHEME.scheme + ':') return;
            if (document.readyState === 'loading')
                document.addEventListener('DOMContentLoaded', () => start(shell), { once: true });
            else start(shell);
        }

        // MARK: - Private
        function start(shell) {
            const { page } = PROTOCOL.setup.invoke();
            if (page) shell?.page(page);
            else DECK.start({ layer: MOD.layerOf(shell?.mod || null) });
        }

        return { boot };
    }
);
