DeckitModule.define(
    'deckit/service/runtime/page',
    {
        uses: ['deckit/service/runtime/protocol'],
        provides: ['about', 'restart'],
    },
    (PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        function about() {
            return PROTOCOL.about.invoke();
        }

        function restart() {
            return PROTOCOL.restart.invoke();
        }

        // MARK: - Private

        return { about, restart };
    }
);
