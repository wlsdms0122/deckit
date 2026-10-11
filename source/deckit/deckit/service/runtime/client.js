DeckitModule.define(
    'deckit/service/runtime/client',
    {
        uses: ['deckit/service/runtime/model/protocol'],
        provides: ['about', 'restart'],
    },
    (PROTOCOL) => {
        const about = () => {
            try {
                return PROTOCOL.about.ask() || {};
            } catch {
                return {};
            }
        };
        const restart = () => PROTOCOL.restart.ask();
        return Object.freeze({ about, restart });
    }
);
